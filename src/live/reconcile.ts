import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { bridgeSecretKey, publicKeyHex } from "../identity.js";
import { roomToZellousChannel } from "../mappers.js";
import { channelStateContent, dtag, parseChannelState, replaceableTimestamp } from "../nostr.js";
import { discordInventory } from "./inventory.js";
import type { RoomRecord } from "../types.js";

export interface ReconcilePublication {
  ok: boolean;
  reversible: boolean;
  relays: number;
  discordCount: number;
  zellousCount: number;
  duplicateNames: string[];
  channels: number;
  categories: number;
  eventId: string;
  previousEventId: string | null;
  rollbackPath: string;
  accepted: number;
}

export interface ReconcileRollback {
  ok: boolean;
  eventId: string;
  previousEventId: string | null;
  restoredChannels: number;
  accepted: number;
}

interface SnapshotBackup {
  serverId: string;
  previousEventId: string | null;
  previousCreatedAt: number | null;
  previousContent: string | null;
  previousTags: string[][];
  publishedEventId: string;
  publishedCreatedAt: number;
  publishedContent: string;
  publishedTags: string[][];
}

function backupPath(config: Config): string {
  return join(config.bridgeStateDir, "snapshot-backup.json");
}

function duplicateNames(rooms: RoomRecord[]): string[] {
  const counts = new Map<string, number>();
  for (const room of rooms) counts.set(room.name, (counts.get(room.name) ?? 0) + 1);
  return [...counts.entries()].filter(function(entry) { return entry[1] > 1; }).map(function(entry) { return entry[0]; }).sort();
}

async function publishEvent(pool: SimplePool, config: Config, content: string, tags: string[][], secretKey: Uint8Array, previousCreatedAt = 0): Promise<{ eventId: string; createdAt: number; accepted: number }> {
  const event = finalizeEvent({ kind: 30078, created_at: replaceableTimestamp(previousCreatedAt), tags, content }, secretKey);
  const promises = pool.publish(config.nostrRelays, event);
  const settled = await Promise.allSettled(promises);
  return { eventId: event.id, createdAt: event.created_at, accepted: settled.filter(function(entry) { return entry.status === "fulfilled"; }).length };
}

export async function publishRoomSnapshot(config: Config, serverId: string): Promise<ReconcilePublication> {
  const rooms = await discordInventory(config);
  const duplicates = duplicateNames(rooms);
  const categories = rooms.filter(function(room) { return room.type === "category"; }).map(function(room) { return { id: room.discordId ?? room.roomId, name: room.name, position: room.position }; });
  const channels = rooms.map(function(room) { return roomToZellousChannel(room); });
  const content = channelStateContent(channels, categories);
  const secretKey = bridgeSecretKey(config);
  const ownerPubkey = publicKeyHex(secretKey);
  const tags = [["d", dtag("channels", serverId)]];
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const previous = await pool.get(config.nostrRelays, { kinds: [30078], authors: [ownerPubkey], "#d": [dtag("channels", serverId)] } as any, { maxWait: 8000 });
  const previousChannels = previous ? parseChannelState(String(previous.content)).channels.length : 0;
  const published = await publishEvent(pool, config, content, tags, secretKey, previous?.created_at ?? 0);
  pool.destroy();
  mkdirSync(config.bridgeStateDir, { recursive: true, mode: 0o700 });
  const path = backupPath(config);
  const backup: SnapshotBackup = {
    serverId,
    previousEventId: previous?.id ?? null,
    previousCreatedAt: previous?.created_at ?? null,
    previousContent: previous ? String(previous.content) : null,
    previousTags: previous ? (previous.tags as string[][]) : [],
    publishedEventId: published.eventId,
    publishedCreatedAt: published.createdAt,
    publishedContent: content,
    publishedTags: tags
  };
  writeFileSync(path, JSON.stringify(backup), { mode: 0o600 });
  return {
    ok: published.accepted > 0,
    reversible: true,
    relays: config.nostrRelays.length,
    discordCount: rooms.length,
    zellousCount: previousChannels,
    duplicateNames: duplicates,
    channels: channels.length,
    categories: categories.length,
    eventId: published.eventId,
    previousEventId: backup.previousEventId,
    rollbackPath: path,
    accepted: published.accepted
  };
}

export async function rollbackRoomSnapshot(config: Config): Promise<ReconcileRollback> {
  const path = backupPath(config);
  if (!existsSync(path)) throw new Error("no snapshot backup exists");
  const backup = JSON.parse(readFileSync(path, "utf8")) as SnapshotBackup;
  const content = backup.previousContent ?? channelStateContent([], []);
  const tags = backup.previousTags.length > 0 ? backup.previousTags : [["d", dtag("channels", backup.serverId)]];
  const secretKey = bridgeSecretKey(config);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const published = await publishEvent(pool, config, content, tags, secretKey, backup.publishedCreatedAt);
  pool.destroy();
  const restored = parseChannelState(content).channels.length;
  return { ok: published.accepted > 0, eventId: published.eventId, previousEventId: backup.previousEventId, restoredChannels: restored, accepted: published.accepted };
}