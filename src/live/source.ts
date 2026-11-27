import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { deriveSecretKey, discordIdentityKey, loadOrCreateSeed, publicKeyHex } from "../identity.js";
import type { MappingStore } from "../mapping.js";
import { channelHash } from "../nostr.js";
import type { RoomRecord } from "../types.js";

export const ATTRIBUTION_PREFIX = "zdb-user:";
export const BRIDGE_TAG = "zdb-bridge";
export const UNKNOWN_ROOT_MARKER = "zdb-unknown-root";

export function channelRoot(serverId: string, discordId: string): string {
  return channelHash(serverId, "room-" + discordId);
}

export function discordChannelId(roomId: string, room?: { discordId?: string | null } | null, mappedRoom?: { discordId?: string | null } | null): string {
  for (const candidate of [room?.discordId, mappedRoom?.discordId]) {
    const value = String(candidate ?? "");
    if (/^[0-9]{17,20}$/.test(value)) return value;
  }
  return String(roomId ?? "").replace("room-", "");
}

export function rootChannelMap(serverId: string, mapping: MappingStore): Map<string, string> {
  const result = new Map<string, string>();
  for (const room of mapping.allRooms()) {
    if (!room.discordId) continue;
    const discordId = String(room.discordId);
    const canonical = "room-" + discordId;
    const candidates = [canonical, discordId];
    if (room.roomId === canonical || room.roomId === discordId || room.roomId === "zellous-" + discordId) candidates.push(room.roomId);
    if (room.zellousId === canonical || room.zellousId === "zellous-" + discordId) candidates.push(room.zellousId);
    for (const candidate of candidates) result.set(channelHash(serverId, candidate), discordId);
  }
  return result;
}

export function attributionTag(username: string): string[] {
  return ["t", ATTRIBUTION_PREFIX + encodeURIComponent(username)];
}

export function parseAttribution(tags: string[][]): string | null {
  const found = tags.filter(function(tag) { return tag[0] === "t" && typeof tag[1] === "string" && tag[1].startsWith(ATTRIBUTION_PREFIX); }).map(function(tag) { return decodeURIComponent(tag[1].slice(ATTRIBUTION_PREFIX.length)); });
  const unique = [...new Set(found)];
  return unique.length === 1 ? unique[0] : null;
}

export function visibleDiscordContent(username: string, content: string): string {
  const prefix = "[" + username + "] ";
  return content.startsWith(prefix) ? content : prefix + content;
}

export function stripDiscordAttribution(content: string): string {
  return content.replace(/^\[[^\]]+\] /, "");
}

export function discordMessageKey(config: Config, userId: string): Uint8Array {
  return deriveSecretKey(loadOrCreateSeed(config.bridgeStateDir), discordIdentityKey(userId));
}

export function discordMessagePubkey(config: Config, userId: string): string {
  return publicKeyHex(discordMessageKey(config, userId));
}

export function discordProfileEvent(secretKey: Uint8Array, username: string): any {
  return finalizeEvent({ kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: JSON.stringify({ name: username }) }, secretKey);
}

export async function liveGuildName(config: Config): Promise<string> {
  const response = await fetch("https://discord.com/api/v10/guilds/" + config.discordGuildId, { headers: { Authorization: "Bot " + config.discordToken.reveal() }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Discord guild request failed with status " + String(response.status));
  const body = await response.json() as { name?: string };
  const name = String(body.name ?? "");
  if (!name) throw new Error("Discord guild name missing");
  return name;
}

function storagePath(config: Config): string {
  return join(config.bridgeStateDir, "wireweave-storage.json");
}

function readStorage(config: Config): Record<string, string> {
  const path = storagePath(config);
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>; } catch { return {}; }
}

export function cachedServerName(config: Config, serverId: string): string | null {
  const raw = readStorage(config).zn_servers;
  if (!raw) return null;
  try {
    const servers = JSON.parse(raw) as Array<{ id: string; name: string }>;
    const found = servers.find(function(server) { return server.id === serverId; });
    return found ? String(found.name) : null;
  } catch { return null; }
}

export function refreshCachedServerName(config: Config, serverId: string, name: string): void {
  const values = readStorage(config);
  let servers: Array<Record<string, unknown>> = [];
  if (values.zn_servers) {
    try { servers = JSON.parse(values.zn_servers) as Array<Record<string, unknown>>; } catch { servers = []; }
  }
  const existing = servers.find(function(server) { return server.id === serverId; });
  if (existing) existing.name = name;
  else servers.push({ id: serverId, name, iconColor: "#5865F2" });
  values.zn_servers = JSON.stringify(servers);
  writeFileSync(storagePath(config), JSON.stringify(values), { mode: 0o600 });
}

export function sourceEvidencePath(): string {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  return join(scratch, "zellous-discord", "source-evidence.json");
}

export function snapshotChannelIds(rooms: RoomRecord[]): string[] {
  return rooms.filter(function(room) { return room.discordId; }).map(function(room) { return String(room.discordId); }).sort();
}
