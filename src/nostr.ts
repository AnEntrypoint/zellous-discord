import { createHash } from "node:crypto";

export const NOSTR_KINDS = {
  server: 34550,
  channels: 30078,
  message: 42,
  deletion: 5,
  reaction: 7,
  profile: 0,
  typing: 20042,
  voice: 30078,
  auth: 22242
};

export function channelHash(serverId: string, channelId: string): string {
  return createHash("sha256").update(serverId + ":" + channelId).digest("hex");
}

export function voiceRoomId(serverId: string, channelName: string): string {
  return "zellous" + createHash("sha256").update(serverId + ":voice:" + channelName).digest("hex").slice(0, 16);
}

export function dtag(namespace: string, ...parts: string[]): string {
  return ["zellous-" + namespace, ...parts].join(":");
}

export function replaceableTimestamp(previous = 0): number {
  return Math.max(Math.floor(Date.now() / 1000), previous + 1);
}

export function nostrTemplate(kind: number, tags: string[][], content: string): Record<string, unknown> {
  return { kind, created_at: replaceableTimestamp(), tags, content };
}

export function channelStateFilter(serverId: string, author?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = { kinds: [NOSTR_KINDS.channels], "#d": [dtag("channels", serverId)] };
  if (author) filter.authors = [author];
  return filter;
}

export function serverMetadataFilter(serverId: string, author: string): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.server], authors: [author], "#d": [serverId.split(":")[1]] };
}

export function messageFilter(serverId: string, channelId: string): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.message], "#e": [channelHash(serverId, channelId)], limit: 500 };
}

export function typingFilter(serverId: string, channelId: string): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.typing], "#e": [channelHash(serverId, channelId)], since: Math.floor(Date.now() / 1000) - 5 };
}

export function presenceFilter(pubkeys: string[]): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.voice], "#d": [dtag("presence", "status")], authors: pubkeys };
}

export function reactionFilter(eventIds: string[]): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.reaction], "#e": eventIds };
}

export function voicePresenceFilter(roomId: string): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.voice], "#d": ["zellous-voice:" + roomId] };
}

export function voiceSignalFilter(roomId: string, pubkey: string): Record<string, unknown> {
  return { kinds: [NOSTR_KINDS.voice], "#p": [pubkey], "#r": [roomId] };
}

export function parseChannelState(content: string): { channels: unknown[]; categories: unknown[] } {
  const parsed = JSON.parse(content) as { channels?: unknown[]; categories?: unknown[] };
  return { channels: Array.isArray(parsed.channels) ? parsed.channels : [], categories: Array.isArray(parsed.categories) ? parsed.categories : [] };
}

export function channelStateContent(channels: unknown[], categories: unknown[]): string {
  return JSON.stringify({ channels, categories });
}

export function tagValue(tags: string[][], name: string): string | null {
  const tag = tags.find((entry) => entry[0] === name);
  return tag && tag[1] ? tag[1] : null;
}