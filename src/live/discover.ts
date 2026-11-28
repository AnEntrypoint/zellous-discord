import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { deriveSecretKey, loadOrCreateSeed, ownerHex, publicKeyHex, requireOwnerKey } from "../identity.js";
import { roomToZellousChannel } from "../mappers.js";
import { channelStateContent, dtag } from "../nostr.js";
import type { RoomRecord } from "../types.js";
import { discordInventory } from "./inventory.js";
import { heldRelays } from "../relay-hold.js";
import { liveGuildIconUrl, liveGuildName, refreshCachedServerName } from "./source.js";

export interface OwnerBundleEvent {
  kind: number;
  eventId: string;
  dTag: string;
  createdAt: number;
  accepted: number;
  rejected: Record<string, string>;
}

export interface OwnerBundlePublication {
  ok: boolean;
  ownerHex: string;
  serverId: string;
  relays: number;
  channels: number;
  textChannels: number;
  pageChannels: number;
  events: OwnerBundleEvent[];
}

function pageChannel(): Record<string, unknown> {
  return { id: "rules", name: "Rules", type: "page", categoryId: null, position: 0, parentChannelId: null, topic: null, nsfw: false, bitrate: null, userLimit: null, rateLimitPerUser: null, permissionOverwrites: [], archived: false, locked: false, autoArchiveDuration: null, invitable: null, contentVersion: 1, tombstone: false };
}

export function ownerChannels(rooms: RoomRecord[]): Record<string, unknown>[] {
  const channels = rooms.map(function(room) { return roomToZellousChannel(room); });
  if (!channels.some(function(channel) { return channel.type === "text"; })) channels.push({ id: "general", name: "general", type: "text", categoryId: null, position: 0, parentChannelId: null, topic: null, nsfw: false, bitrate: null, userLimit: null, rateLimitPerUser: null, permissionOverwrites: [], archived: false, locked: false, autoArchiveDuration: null, invitable: null, contentVersion: 1, tombstone: false });
  if (!channels.some(function(channel) { return channel.type === "page"; })) channels.push(pageChannel());
  return channels;
}

export function buildOwnerBundle(config: Config, serverId: string, rooms: RoomRecord[], secretKey: Uint8Array, createdAtBase: number, guildName: string, guildIcon: string): any[] {
  const owner = ownerHex(config);
  if (publicKeyHex(secretKey) !== owner) throw new Error("owner private key does not match ZELLOUS_SERVER_OWNER_HEX");
  const channels = ownerChannels(rooms);
  const categories = rooms.filter(function(room) { return room.type === "category"; }).map(function(room) { return { id: room.discordId ?? room.roomId, name: room.name, position: room.position }; });
  const adminPubkey = publicKeyHex(deriveSecretKey(loadOrCreateSeed(config.bridgeStateDir), "discover-admin"));
  const listing = {
    v: 1,
    serverId,
    status: "listed",
    action: "promote",
    by: owner,
    name: guildName,
    description: "Live Discord guild bridge for zellous chat, channels and Discover.",
    icon: guildIcon,
    category: "community",
    language: "en",
    tags: ["discord", "bridge", "chat"],
    guidelines: true
  };
  const templates = [
    { kind: 34550, created_at: createdAtBase + 1, tags: [["d", config.zellousServerDTag], ["name", guildName], ["icon", guildIcon], ["color", "#5865F2"]], content: "" },
    { kind: 30078, created_at: createdAtBase + 2, tags: [["d", dtag("discover", serverId)], ["t", "zellous-discover"], ["status", "listed"], ["by", owner], ["guidelines", "true"]], content: JSON.stringify(listing) },
    { kind: 30078, created_at: createdAtBase + 3, tags: [["d", dtag("roles", serverId)]], content: JSON.stringify({ admins: [adminPubkey], mods: [], editors: [] }) },
    { kind: 30078, created_at: createdAtBase + 4, tags: [["d", dtag("channels", serverId)]], content: channelStateContent(channels, categories) }
  ];
  return templates.map(function(template) { return finalizeEvent(template, secretKey); });
}

export async function publishOwnerBundle(config: Config, serverId: string): Promise<OwnerBundlePublication> {
  const secretKey = requireOwnerKey(config);
  const rooms = await discordInventory(config);
  const guildName = await liveGuildName(config);
  const guildIcon = await liveGuildIconUrl(config);
  refreshCachedServerName(config, serverId, guildName, guildIcon);
  const channels = ownerChannels(rooms);
  const events = buildOwnerBundle(config, serverId, rooms, secretKey, Math.floor(Date.now() / 1000), guildName, guildIcon);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const published: OwnerBundleEvent[] = [];
  const held = heldRelays(config.bridgeStateDir);
  for (const event of events) {
    const accepted = new Set<string>();
    const rejected = new Map<string, string>();
    const dTag = (event.tags.find(function(tag: string[]) { return tag[0] === "d"; }) || [])[1] ?? "";
    for (const relay of config.nostrRelays) {
      const timeoutCurrent = new Promise<any[]>(function(resolve) { setTimeout(function() { resolve([]); }, 8000); });
      const current = await Promise.race<any[]>([pool.querySync([relay], { kinds: [event.kind], authors: [event.pubkey], "#d": [dTag], limit: 5 }, { maxWait: 6000 }).catch(function() { return []; }), timeoutCurrent]);
      const newest = current.sort(function(a: any, b: any) { return b.created_at - a.created_at; })[0];
      const wanted = JSON.stringify(event.tags) + event.content;
      if (newest && JSON.stringify(newest.tags) + newest.content === wanted) accepted.add(relay);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pending = config.nostrRelays.filter(function(url) { return !accepted.has(url) && !held.includes(url); });
      if (pending.length === 0) break;
      if (attempt > 0) await new Promise<void>(function(resolve) { setTimeout(resolve, 15000); });
      const promises = pool.publish(pending, event);
      const timeout = new Promise<PromiseSettledResult<unknown>[]>(function(resolve) { setTimeout(function() { resolve([]); }, 10000); });
      const settled = await Promise.race<PromiseSettledResult<unknown>[]>([Promise.allSettled(promises), timeout]);
      settled.forEach(function(entry, index) {
        if (entry.status === "fulfilled") { accepted.add(pending[index]); rejected.delete(pending[index]); }
        else rejected.set(pending[index], String((entry as PromiseRejectedResult).reason?.message ?? (entry as PromiseRejectedResult).reason ?? "rejected"));
      });
      const retryable = [...rejected.values()].some(function(reason) { return /rate-limited/i.test(reason); });
      if (!retryable) break;
    }
    const d = (event.tags.find(function(tag: string[]) { return tag[0] === "d"; }) || [])[1] ?? "";
    published.push({ kind: event.kind, eventId: event.id, dTag: d, createdAt: event.created_at, accepted: accepted.size, rejected: Object.fromEntries(rejected) });
  }
  pool.destroy();
  mkdirSync(config.bridgeStateDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(config.bridgeStateDir, "discover-events.json"), JSON.stringify(events.map(function(event) { return event.id; })), { mode: 0o600 });
  return {
    ok: published.every(function(entry) { return entry.accepted > 0; }),
    ownerHex: ownerHex(config),
    serverId,
    relays: config.nostrRelays.length,
    channels: channels.length,
    textChannels: channels.filter(function(channel) { return channel.type === "text"; }).length,
    pageChannels: channels.filter(function(channel) { return channel.type === "page"; }).length,
    events: published
  };
}
