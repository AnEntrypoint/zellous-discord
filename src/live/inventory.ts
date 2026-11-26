import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import type { Config } from "../config.js";
import { mapDiscordChannelToRoom, mapZellousChannelToRoom, type DiscordChannelLike, type ZellousChannelLike } from "../mappers.js";
import { channelStateFilter, parseChannelState } from "../nostr.js";
import type { RoomRecord } from "../types.js";

export interface InventoryComparison {
  ok: boolean;
  discordCount: number;
  zellousCount: number;
  missingInZellous: string[];
  missingInDiscord: string[];
  mismatches: string[];
}

function roomKey(room: RoomRecord): string {
  return [room.type, room.name, String(room.position), room.parentId ?? "", room.topic ?? ""].join("|");
}

export function compareInventories(discordRooms: RoomRecord[], zellousRooms: RoomRecord[]): InventoryComparison {
  const discordKeys = new Map(discordRooms.map((room) => [roomKey(room), room]));
  const zellousKeys = new Map(zellousRooms.map((room) => [roomKey(room), room]));
  const missingInZellous = [...discordKeys.keys()].filter((key) => !zellousKeys.has(key));
  const missingInDiscord = [...zellousKeys.keys()].filter((key) => !discordKeys.has(key));
  const mismatches: string[] = [];
  for (const [key, discordRoom] of discordKeys) {
    const zellousRoom = zellousKeys.get(key);
    if (!zellousRoom) continue;
    if (discordRoom.type !== zellousRoom.type || discordRoom.name !== zellousRoom.name || discordRoom.position !== zellousRoom.position) mismatches.push(key);
  }
  const countsMatch = discordRooms.length === zellousRooms.length;
  if (!countsMatch) mismatches.push("room-count:" + String(discordRooms.length) + "!=" + String(zellousRooms.length));
  return { ok: countsMatch && missingInZellous.length === 0 && missingInDiscord.length === 0 && mismatches.length === 0, discordCount: discordRooms.length, zellousCount: zellousRooms.length, missingInZellous, missingInDiscord, mismatches };
}

export async function discordInventory(config: Config): Promise<RoomRecord[]> {
  const response = await fetch("https://discord.com/api/v10/guilds/" + config.discordGuildId + "/channels", {
    headers: { Authorization: "Bot " + config.discordToken.reveal() },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Discord inventory failed with status " + String(response.status));
  const channels = await response.json() as DiscordChannelLike[];
  return channels.map((channel) => mapDiscordChannelToRoom(channel, config.zellousServerId, config.discordGuildId));
}

export async function nostrInventory(config: Config, serverId: string, ownerPubkey: string): Promise<RoomRecord[]> {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try {
    const event = await pool.get(config.nostrRelays, channelStateFilter(serverId, ownerPubkey) as any, { maxWait: 8000 });
    if (!event) return [];
    const state = parseChannelState(String(event.content));
    return state.channels.map((channel) => mapZellousChannelToRoom(channel as ZellousChannelLike, serverId, config.discordGuildId));
  } finally {
    pool.destroy();
  }
}

export async function liveInventory(config: Config, serverId: string, ownerPubkey: string): Promise<InventoryComparison> {
  const discordRooms = await discordInventory(config);
  const zellousRooms = await nostrInventory(config, serverId, ownerPubkey);
  return compareInventories(discordRooms, zellousRooms);
}