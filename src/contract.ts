import type { CanonicalEvent } from "./types.js";

export const CONTRACT_VERSION = 1;

export const ROOM_FIELDS = [
  "roomId", "discordId", "zellousId", "serverId", "guildId", "type", "parentId", "position", "name", "topic",
  "discordType", "categoryId", "channelHash", "nsfw", "bitrate", "userLimit", "rateLimitPerUser", "permissionOverwrites",
  "archived", "locked", "autoArchiveDuration", "invitable", "contentVersion", "tombstone", "createdAt", "updatedAt", "deletedAt"
];

export const MESSAGE_FIELDS = [
  "messageId", "discordId", "zellousEventId", "roomId", "author", "content", "createdAt", "editedAt", "replyTo",
  "mentions", "attachments", "reactions", "previews", "announcement", "correctionOf", "deleted", "contentVersion",
  "typing", "presence", "profile"
];

export const PRESENCE_FIELDS = [
  "userId", "status", "custom", "until", "voiceChannelId", "muted", "deafened", "speaking", "lastSeen", "online",
  "idle", "dnd", "invisible", "offline"
];

export const VOICE_FIELDS = [
  "voiceId", "roomId", "discordUserId", "zellousPubkey", "direction", "identity", "workerId", "streamId", "ssrc",
  "speaking", "muted", "deafened", "connectionQuality", "leave", "signalType", "sdp", "iceCandidate", "fromPubkey",
  "toPubkey", "dTag", "pTag", "rTag", "opusPayload", "sequence", "timestamp", "sampleRate", "channels", "codec",
  "marker", "action", "channel", "server", "ts", "rttScores", "capScores", "reflexive", "uplinkKbps"
];

export const ENVELOPE_FIELDS = [
  "schemaVersion", "eventId", "source", "sourceId", "operation", "version", "idempotencyKey", "occurredAt",
  "actor", "room", "payload", "suppressionKey", "tracing"
];

export const ALL_CONTRACT_FIELDS = [...new Set([...ENVELOPE_FIELDS, ...ROOM_FIELDS, ...MESSAGE_FIELDS, ...PRESENCE_FIELDS, ...VOICE_FIELDS])];

export function validateCanonicalEvent(event: CanonicalEvent): string[] {
  const errors: string[] = [];
  for (const field of ENVELOPE_FIELDS) if (!(field in event)) errors.push("missing envelope field " + field);
  if (event.schemaVersion !== CONTRACT_VERSION) errors.push("unsupported schemaVersion");
  if (!event.idempotencyKey || !event.eventId) errors.push("missing integrity hash");
  if (!Array.isArray(event.tracing)) errors.push("tracing must be an array");
  if (event.operation.startsWith("room.") && event.room === null) errors.push("room operation needs room");
  return errors;
}