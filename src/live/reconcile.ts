import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { deriveSecretKey, loadOrCreateSeed } from "../identity.js";
import { roomToZellousChannel } from "../mappers.js";
import { channelStateContent, dtag } from "../nostr.js";
import { discordInventory } from "./inventory.js";

export interface ReconcilePublication {
  ok: boolean;
  relays: number;
  channels: number;
  categories: number;
  eventId: string;
  accepted: number;
}

export async function publishRoomSnapshot(config: Config, serverId: string): Promise<ReconcilePublication> {
  const rooms = await discordInventory(config);
  const categories = rooms.filter((room) => room.type === "category").map((room) => ({ id: room.discordId ?? room.roomId, name: room.name, position: room.position }));
  const channels = rooms.map((room) => roomToZellousChannel(room));
  const content = channelStateContent(channels, categories);
  const seed = loadOrCreateSeed(config.bridgeStateDir);
  const secretKey = deriveSecretKey(seed, "bridge");
  const event = finalizeEvent({ kind: 30078, created_at: Math.floor(Date.now() / 1000), tags: [["d", dtag("channels", serverId)]], content }, secretKey);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const promises = pool.publish(config.nostrRelays, event);
  const settled = await Promise.allSettled(promises);
  const accepted = settled.filter((entry) => entry.status === "fulfilled").length;
  pool.destroy();
  return { ok: accepted > 0, relays: config.nostrRelays.length, channels: channels.length, categories: categories.length, eventId: event.id, accepted };
}