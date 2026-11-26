import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { ownerHex, requireOwnerKey } from "../identity.js";
import { mapDiscordChannelToRoom, type DiscordChannelLike } from "../mappers.js";
import { channelStateContent, dtag, replaceableTimestamp } from "../nostr.js";
import { ownerChannels } from "./discover.js";

const DISCORD_EPOCH_MS = 1420070400000n;
const BRIDGE_CREATED_AFTER_MS = BigInt(Date.parse("2026-11-01T00:00:00.000Z"));

export interface CleanupBackup {
  serverId: string;
  ownerHex: string;
  createdAt: number;
  cutoff: string;
  discordChannels: DiscordChannelLike[];
  canonicalIds: string[];
  duplicateIds: string[];
  relayEventIds: string[];
  previousSnapshotEventId: string | null;
  previousSnapshotCreatedAt: number;
  previousSnapshotContent: string;
  previousSnapshotTags: string[][];
  publishedSnapshotEventId: string;
  publishedSnapshotCreatedAt: number;
  publishedSnapshotContent: string;
  publishedSnapshotTags: string[][];
  deletionEventIds: string[];
}

export interface CleanupResult {
  ok: boolean;
  reversible: boolean;
  backupPath: string;
  serverId: string;
  ownerHex: string;
  beforeDiscordCount: number;
  afterDiscordCount: number;
  canonicalCount: number;
  duplicateCount: number;
  canonicalIds: string[];
  deletedDiscordIds: string[];
  remainingDuplicateIds: string[];
  missingCanonicalIds: string[];
  afterDuplicateKeys: string[];
  beforeRelayCount: number;
  afterRelayCount: number;
  beforeRelayEventIds: string[];
  afterRelayEventIds: string[];
  deletedRelayEventIds: string[];
  publishedSnapshotEventId: string;
  publishedSnapshotCreatedAt: number;
  publishedSnapshotAccepted: number;
  deletionEventIds: string[];
}

export interface CleanupRollbackResult {
  ok: boolean;
  backupPath: string;
  restoredSnapshotEventId: string;
  restoredSnapshotAccepted: number;
  requestedDiscordIds: string[];
  recreatedDiscordIds: string[];
  recreatedPairs: Array<{ originalId: string; createdId: string }>;
  afterDiscordCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

export function bridgeCreatedCutoff(): bigint {
  return (BRIDGE_CREATED_AFTER_MS - DISCORD_EPOCH_MS) << 22n;
}

export function channelGroupKey(channel: DiscordChannelLike): string {
  return [String(channel.type), channel.name, channel.parent_id ?? "", channel.topic ?? ""].join("|");
}

export function duplicateKeys(channels: DiscordChannelLike[]): string[] {
  const groups = new Map<string, number>();
  for (const channel of channels) {
    const key = channelGroupKey(channel);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()].filter(function(entry) { return entry[1] > 1; }).map(function(entry) { return entry[0]; }).sort();
}

export function splitChannels(channels: DiscordChannelLike[]): { canonical: DiscordChannelLike[]; duplicates: DiscordChannelLike[]; canonicalIds: string[]; duplicateIds: string[] } {
  const cutoff = bridgeCreatedCutoff();
  const canonical = channels.filter(function(channel) { return BigInt(channel.id) < cutoff; });
  const duplicates = channels.filter(function(channel) { return BigInt(channel.id) >= cutoff; });
  return { canonical, duplicates, canonicalIds: canonical.map(function(channel) { return channel.id; }).sort(), duplicateIds: duplicates.map(function(channel) { return channel.id; }).sort() };
}

export function assertBridgeDuplicates(canonical: DiscordChannelLike[], duplicates: DiscordChannelLike[]): void {
  const names = new Set(canonical.map(function(channel) { return channel.name; }));
  for (const channel of duplicates) {
    if (!names.has(channel.name)) throw new Error("bridge channel is not a duplicate of a canonical name");
  }
}

async function discordRequest(config: Config, method: string, path: string, body?: unknown): Promise<any> {
  const response = await fetch("https://discord.com/api/v10" + path, {
    method,
    headers: { Authorization: "Bot " + config.discordToken.reveal(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 429) {
    await sleep(1000);
    return discordRequest(config, method, path, body);
  }
  if (response.status === 204) return {};
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error("discord request failed status=" + String(response.status) + " " + text);
  }
  if (response.status === 404) return {};
  return await response.json();
}

export async function rawChannels(config: Config): Promise<DiscordChannelLike[]> {
  return await discordRequest(config, "GET", "/guilds/" + config.discordGuildId + "/channels") as DiscordChannelLike[];
}

function snapshotFilter(serverId: string, owner: string): any {
  return { kinds: [30078], authors: [owner], "#d": [dtag("channels", serverId)], limit: 1000 };
}

export async function relaySnapshotEvents(config: Config, serverId: string): Promise<any[]> {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try {
    return await pool.querySync(config.nostrRelays, snapshotFilter(serverId, ownerHex(config)), { maxWait: 10000 }) as any[];
  } finally {
    pool.destroy();
  }
}

async function publishEvent(config: Config, pool: SimplePool, event: any): Promise<number> {
  const settled = await Promise.allSettled(pool.publish(config.nostrRelays, event));
  return settled.filter(function(entry) { return entry.status === "fulfilled"; }).length;
}

function buildSnapshotContent(channels: DiscordChannelLike[], config: Config, serverId: string): string {
  const rooms = channels.map(function(channel) { return mapDiscordChannelToRoom(channel, serverId, config.discordGuildId); });
  const zellousChannels = ownerChannels(rooms);
  const categories = rooms.filter(function(room) { return room.type === "category"; }).map(function(room) { return { id: room.discordId ?? room.roomId, name: room.name, position: room.position }; });
  return channelStateContent(zellousChannels, categories);
}

function backupPath(config: Config): string {
  return join(config.bridgeStateDir, "cleanup-backup.json");
}

export function readCleanupBackup(config: Config): CleanupBackup {
  const path = backupPath(config);
  if (!existsSync(path)) throw new Error("cleanup backup missing");
  return JSON.parse(readFileSync(path, "utf8")) as CleanupBackup;
}

export function channelCreatePayload(channel: DiscordChannelLike): Record<string, unknown> {
  const payload: Record<string, unknown> = { name: channel.name, type: channel.type, position: channel.position ?? 0 };
  if (channel.parent_id) payload.parent_id = channel.parent_id;
  if (channel.topic) payload.topic = channel.topic;
  if (typeof channel.nsfw === "boolean") payload.nsfw = channel.nsfw;
  if (channel.bitrate) payload.bitrate = channel.bitrate;
  if (channel.user_limit) payload.user_limit = channel.user_limit;
  if (channel.rate_limit_per_user) payload.rate_limit_per_user = channel.rate_limit_per_user;
  if (Array.isArray(channel.permission_overwrites)) payload.permission_overwrites = channel.permission_overwrites;
  return payload;
}

export async function cleanupDuplicateChannels(config: Config, serverId: string): Promise<CleanupResult> {
  const secretKey = requireOwnerKey(config);
  const owner = ownerHex(config);
  const before = await rawChannels(config);
  const split = splitChannels(before);
  assertBridgeDuplicates(split.canonical, split.duplicates);
  const beforeEvents = await relaySnapshotEvents(config, serverId);
  const beforeRelayEventIds = beforeEvents.map(function(event) { return event.id as string; }).sort();
  const previous = beforeEvents.slice().sort(function(a, b) { return b.created_at - a.created_at; })[0] ?? null;
  const previousSnapshotEventId = previous ? previous.id as string : null;
  const previousSnapshotCreatedAt = previous ? previous.created_at as number : 0;
  const previousSnapshotContent = previous ? String(previous.content) : channelStateContent([], []);
  const previousSnapshotTags = previous ? previous.tags as string[][] : [["d", dtag("channels", serverId)]];
  const publishedSnapshotContent = buildSnapshotContent(split.canonical, config, serverId);
  const publishedSnapshotTags = [["d", dtag("channels", serverId)]];
  const publishedSnapshotCreatedAt = replaceableTimestamp(previousSnapshotCreatedAt);
  const publishedSnapshotEvent = finalizeEvent({ kind: 30078, created_at: publishedSnapshotCreatedAt, tags: publishedSnapshotTags, content: publishedSnapshotContent }, secretKey);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  let publishedSnapshotAccepted = 0;
  const deletionEventIds: string[] = [];
  let afterEvents: any[] = [];
  try {
    publishedSnapshotAccepted = await publishEvent(config, pool, publishedSnapshotEvent);
    const deletionTargets = beforeEvents.filter(function(event) { return event.id !== publishedSnapshotEvent.id; });
    for (let offset = 0; offset < deletionTargets.length; offset += 100) {
      const tags = deletionTargets.slice(offset, offset + 100).map(function(event) { return ["e", event.id as string]; });
      tags.push(["k", "30078"]);
      const deletionEvent = finalizeEvent({ kind: 5, created_at: replaceableTimestamp(publishedSnapshotCreatedAt + offset), tags, content: "duplicate channel snapshot cleanup" }, secretKey);
      deletionEventIds.push(deletionEvent.id);
      await publishEvent(config, pool, deletionEvent);
    }
    afterEvents = await pool.querySync(config.nostrRelays, snapshotFilter(serverId, owner), { maxWait: 10000 }) as any[];
  } finally {
    pool.destroy();
  }
  const backup: CleanupBackup = {
    serverId,
    ownerHex: owner,
    createdAt: Math.floor(Date.now() / 1000),
    cutoff: String(bridgeCreatedCutoff()),
    discordChannels: before,
    canonicalIds: split.canonicalIds,
    duplicateIds: split.duplicateIds,
    relayEventIds: beforeRelayEventIds,
    previousSnapshotEventId,
    previousSnapshotCreatedAt,
    previousSnapshotContent,
    previousSnapshotTags,
    publishedSnapshotEventId: publishedSnapshotEvent.id,
    publishedSnapshotCreatedAt,
    publishedSnapshotContent,
    publishedSnapshotTags,
    deletionEventIds
  };
  mkdirSync(config.bridgeStateDir, { recursive: true, mode: 0o700 });
  writeFileSync(backupPath(config), JSON.stringify(backup), { mode: 0o600 });
  for (const id of split.duplicateIds) {
    await discordRequest(config, "DELETE", "/channels/" + id);
    await sleep(25);
  }
  const after = await rawChannels(config);
  const afterIds = new Set(after.map(function(channel) { return channel.id; }));
  const missingCanonicalIds = split.canonicalIds.filter(function(id) { return !afterIds.has(id); });
  const remainingDuplicateIds = split.duplicateIds.filter(function(id) { return afterIds.has(id); });
  const afterDuplicateKeys = duplicateKeys(after);
  const afterRelayEventIds = afterEvents.map(function(event) { return event.id as string; }).sort();
  const afterSet = new Set(afterRelayEventIds);
  const deletedRelayEventIds = beforeRelayEventIds.filter(function(id) { return !afterSet.has(id); });
  return {
    ok: publishedSnapshotAccepted > 0 && missingCanonicalIds.length === 0 && remainingDuplicateIds.length === 0 && afterDuplicateKeys.length === 0,
    reversible: true,
    backupPath: backupPath(config),
    serverId,
    ownerHex: owner,
    beforeDiscordCount: before.length,
    afterDiscordCount: after.length,
    canonicalCount: split.canonicalIds.length,
    duplicateCount: split.duplicateIds.length,
    canonicalIds: split.canonicalIds,
    deletedDiscordIds: split.duplicateIds,
    remainingDuplicateIds,
    missingCanonicalIds,
    afterDuplicateKeys,
    beforeRelayCount: beforeRelayEventIds.length,
    afterRelayCount: afterRelayEventIds.length,
    beforeRelayEventIds,
    afterRelayEventIds,
    deletedRelayEventIds,
    publishedSnapshotEventId: publishedSnapshotEvent.id,
    publishedSnapshotCreatedAt,
    publishedSnapshotAccepted,
    deletionEventIds
  };
}

export async function rollbackCleanup(config: Config): Promise<CleanupRollbackResult> {
  const backup = readCleanupBackup(config);
  const secretKey = requireOwnerKey(config);
  const restoredSnapshotEvent = finalizeEvent({ kind: 30078, created_at: replaceableTimestamp(backup.publishedSnapshotCreatedAt), tags: backup.previousSnapshotTags, content: backup.previousSnapshotContent }, secretKey);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  let restoredSnapshotAccepted = 0;
  try {
    restoredSnapshotAccepted = await publishEvent(config, pool, restoredSnapshotEvent);
  } finally {
    pool.destroy();
  }
  const requestedIds = backup.duplicateIds.slice();
  const recreatedPairs: Array<{ originalId: string; createdId: string }> = [];
  for (const channel of backup.discordChannels) {
    if (!requestedIds.includes(channel.id)) continue;
    const created = await discordRequest(config, "POST", "/guilds/" + config.discordGuildId + "/channels", channelCreatePayload(channel)) as { id: string };
    recreatedPairs.push({ originalId: channel.id, createdId: created.id });
    await sleep(25);
  }
  const after = await rawChannels(config);
  return {
    ok: restoredSnapshotAccepted > 0 && recreatedPairs.length === requestedIds.length,
    backupPath: backupPath(config),
    restoredSnapshotEventId: restoredSnapshotEvent.id,
    restoredSnapshotAccepted,
    requestedDiscordIds: requestedIds,
    recreatedDiscordIds: recreatedPairs.map(function(pair) { return pair.createdId; }),
    recreatedPairs,
    afterDiscordCount: after.length
  };
}

export async function cleanupState(config: Config, serverId: string): Promise<{ backup: CleanupBackup; channels: DiscordChannelLike[]; missingCanonicalIds: string[]; resurrectedDuplicateIds: string[]; duplicateKeys: string[]; relayEventIds: string[] }> {
  const backup = readCleanupBackup(config);
  const channels = await rawChannels(config);
  const ids = new Set(channels.map(function(channel) { return channel.id; }));
  const missingCanonicalIds = backup.canonicalIds.filter(function(id) { return !ids.has(id); });
  const resurrectedDuplicateIds = backup.duplicateIds.filter(function(id) { return ids.has(id); });
  const keys = duplicateKeys(channels);
  const events = await relaySnapshotEvents(config, serverId);
  return { backup, channels, missingCanonicalIds, resurrectedDuplicateIds, duplicateKeys: keys, relayEventIds: events.map(function(event) { return event.id as string; }).sort() };
}
