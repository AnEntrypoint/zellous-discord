import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { finalizeEvent } from "nostr-tools/pure";
import type { Config } from "../config.js";
import { requireOwnerKey } from "../identity.js";
import { channelHash } from "../nostr.js";
import { attributionTag } from "./source.js";

export interface ChatPublication {
  ok: boolean;
  eventId: string;
  serverId: string;
  channelId: string;
  channelHash: string;
  username: string;
  accepted: number;
}

export async function publishChatEvent(config: Config, serverId: string, channelId: string, content: string, username = "zellous"): Promise<ChatPublication> {
  if (!channelId || !content.trim()) throw new Error("chat-post needs channelId and content");
  const secretKey = requireOwnerKey(config);
  const hash = channelHash(serverId, channelId);
  const event = finalizeEvent({ kind: 42, created_at: Math.floor(Date.now() / 1000), tags: [["e", hash, "", "root"], attributionTag(username)], content: content.trim() }, secretKey);
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const promises = pool.publish(config.nostrRelays, event);
  const settled = await Promise.allSettled(promises);
  pool.destroy();
  const accepted = settled.filter(function(entry) { return entry.status === "fulfilled"; }).length;
  return { ok: accepted > 0, eventId: event.id, serverId, channelId, channelHash: hash, username, accepted };
}