import { channelHash, NOSTR_KINDS, nostrTemplate } from "./nostr.js";
import type { ActorRef, AttachmentRecord, MessageRecord, PresenceRecord, ProfileRecord, ReactionRecord, RoomRecord, RoomType } from "./types.js";

export interface DiscordChannelLike {
  id: string;
  type: number;
  name: string;
  parent_id?: string | null;
  position?: number;
  topic?: string | null;
  nsfw?: boolean;
  bitrate?: number | null;
  user_limit?: number | null;
  rate_limit_per_user?: number | null;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
  archived?: boolean;
  locked?: boolean;
  auto_archive_duration?: number | null;
  invitable?: boolean | null;
}

export interface ZellousChannelLike {
  id: string;
  name: string;
  type: string;
  categoryId?: string | null;
  position?: number;
  parentChannelId?: string | null;
  topic?: string | null;
  nsfw?: boolean;
  bitrate?: number | null;
  userLimit?: number | null;
  rateLimitPerUser?: number | null;
  permissionOverwrites?: Array<{ id: string; type: string; allow: string; deny: string }>;
  archived?: boolean;
  locked?: boolean;
  autoArchiveDuration?: number | null;
  invitable?: boolean | null;
  contentVersion?: number;
  tombstone?: boolean;
}

export interface DiscordMessageLike {
  id: string;
  content: string;
  author: { id: string; username: string; avatar?: string | null };
  timestamp: number;
  edited_timestamp?: number | null;
  message_reference?: { message_id?: string } | null;
  mentions?: string[];
  attachments?: Array<{ url: string; content_type?: string; size?: number; filename?: string; width?: number | null; height?: number | null }>;
  reactions?: Array<{ emoji: string; userId: string; createdAt: number }>;
  previews?: unknown[];
  announcement?: boolean;
}

const discordTypeToRoomType: Record<number, RoomType> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  10: "thread",
  11: "thread",
  12: "thread",
  13: "stage",
  14: "category",
  15: "forum",
  16: "forum"
};

const roomTypeToDiscordType: Record<RoomType, number> = {
  category: 4,
  text: 0,
  announcement: 5,
  forum: 15,
  thread: 11,
  stage: 13,
  voice: 2
};

export const ALL_ROOM_TYPES: RoomType[] = ["category", "text", "announcement", "forum", "thread", "stage", "voice"];

export function mapDiscordChannelToRoom(channel: DiscordChannelLike, serverId: string, guildId: string, version = 1): RoomRecord {
  const now = Date.now();
  return {
    roomId: "room-" + channel.id,
    discordId: channel.id,
    zellousId: null,
    serverId,
    guildId,
    type: discordTypeToRoomType[channel.type] ?? "text",
    parentId: channel.parent_id ?? null,
    position: channel.position ?? 0,
    name: channel.name,
    topic: channel.topic ?? null,
    discordType: channel.type,
    categoryId: null,
    channelHash: channelHash(serverId, channel.id),
    nsfw: channel.nsfw ?? false,
    bitrate: channel.bitrate ?? null,
    userLimit: channel.user_limit ?? null,
    rateLimitPerUser: channel.rate_limit_per_user ?? null,
    permissionOverwrites: (channel.permission_overwrites ?? []).map((entry) => ({ id: entry.id, type: entry.type === 1 ? "member" : "role", allow: entry.allow, deny: entry.deny })),
    archived: channel.archived ?? false,
    locked: channel.locked ?? false,
    autoArchiveDuration: channel.auto_archive_duration ?? null,
    invitable: channel.invitable ?? null,
    contentVersion: version,
    tombstone: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

export function mapZellousChannelToRoom(channel: ZellousChannelLike, serverId: string, guildId: string, version = 1): RoomRecord {
  const now = Date.now();
  return {
    roomId: "room-" + channel.id,
    discordId: null,
    zellousId: channel.id,
    serverId,
    guildId,
    type: (channel.type as RoomType) ?? "text",
    parentId: channel.parentChannelId ?? null,
    position: channel.position ?? 0,
    name: channel.name,
    topic: channel.topic ?? null,
    discordType: null,
    categoryId: channel.categoryId ?? null,
    channelHash: channelHash(serverId, channel.id),
    nsfw: channel.nsfw ?? false,
    bitrate: channel.bitrate ?? null,
    userLimit: channel.userLimit ?? null,
    rateLimitPerUser: channel.rateLimitPerUser ?? null,
    permissionOverwrites: channel.permissionOverwrites ?? [],
    archived: channel.archived ?? false,
    locked: channel.locked ?? false,
    autoArchiveDuration: channel.autoArchiveDuration ?? null,
    invitable: channel.invitable ?? null,
    contentVersion: channel.contentVersion ?? version,
    tombstone: channel.tombstone ?? false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

export function roomToDiscordCreate(room: RoomRecord): Record<string, unknown> {
  return {
    name: room.name,
    type: roomTypeToDiscordType[room.type],
    parent_id: room.parentId,
    position: room.position,
    topic: room.topic,
    nsfw: room.nsfw,
    bitrate: room.bitrate,
    user_limit: room.userLimit,
    rate_limit_per_user: room.rateLimitPerUser,
    permission_overwrites: room.permissionOverwrites.map((entry) => ({ id: entry.id, type: entry.type === "member" ? 1 : 0, allow: entry.allow, deny: entry.deny }))
  };
}

export function roomToDiscordPatch(room: RoomRecord): Record<string, unknown> {
  return {
    name: room.name,
    parent_id: room.parentId,
    position: room.position,
    topic: room.topic,
    nsfw: room.nsfw,
    bitrate: room.bitrate,
    user_limit: room.userLimit,
    rate_limit_per_user: room.rateLimitPerUser,
    archived: room.archived,
    locked: room.locked,
    auto_archive_duration: room.autoArchiveDuration,
    invitable: room.invitable
  };
}

export function roomToZellousChannel(room: RoomRecord): Record<string, unknown> {
  return {
    id: room.zellousId ?? room.roomId,
    name: room.name,
    type: room.type,
    categoryId: room.categoryId,
    position: room.position,
    parentChannelId: room.parentId,
    topic: room.topic,
    nsfw: room.nsfw,
    bitrate: room.bitrate,
    userLimit: room.userLimit,
    rateLimitPerUser: room.rateLimitPerUser,
    permissionOverwrites: room.permissionOverwrites,
    archived: room.archived,
    locked: room.locked,
    autoArchiveDuration: room.autoArchiveDuration,
    invitable: room.invitable,
    contentVersion: room.contentVersion,
    tombstone: room.tombstone
  };
}

export function mapDiscordMessageToMessage(message: DiscordMessageLike, room: RoomRecord, author: ActorRef): MessageRecord {
  return {
    messageId: "message-" + message.id,
    discordId: message.id,
    zellousEventId: null,
    roomId: room.roomId,
    author,
    content: message.content,
    createdAt: message.timestamp,
    editedAt: message.edited_timestamp ?? null,
    replyTo: message.message_reference?.message_id ?? null,
    mentions: message.mentions ?? [],
    attachments: (message.attachments ?? []).map((item) => ({ url: item.url, mime: item.content_type ?? "", size: item.size ?? null, name: item.filename ?? null, width: item.width ?? null, height: item.height ?? null, durationMs: null })),
    reactions: (message.reactions ?? []).map((item) => ({ messageId: "message-" + message.id, emoji: item.emoji, userId: item.userId, source: "discord", createdAt: item.createdAt, removedAt: null })),
    previews: (message.previews ?? []) as MessageRecord["previews"],
    announcement: message.announcement ?? false,
    correctionOf: null,
    deleted: false,
    contentVersion: 1
  };
}

export function mapNostrEventToMessage(event: Record<string, unknown>, room: RoomRecord): MessageRecord {
  const tags = (event.tags as string[][]) ?? [];
  const imeta = tags.find((tag) => tag[0] === "imeta");
  const attachments: AttachmentRecord[] = imeta ? [{ url: String((imeta.find((part) => part.startsWith("url ")) ?? "url ").slice(4)), mime: String((imeta.find((part) => part.startsWith("m ")) ?? "m ").slice(2)), size: null, name: null, width: null, height: null, durationMs: null }] : [];
  const replyTag = tags.find((tag) => tag[0] === "e" && tag[3] === "reply");
  return {
    messageId: "message-" + String(event.id),
    discordId: null,
    zellousEventId: String(event.id),
    roomId: room.roomId,
    author: { source: "zellous", sourceUserId: String(event.pubkey), bridgePubkey: String(event.pubkey), displayName: String(event.pubkey).slice(0, 8), avatarUrl: null },
    content: String(event.content ?? ""),
    createdAt: Number(event.created_at) * 1000,
    editedAt: null,
    replyTo: replyTag ? replyTag[1] : null,
    mentions: [],
    attachments,
    reactions: [],
    previews: [],
    announcement: tags.some((tag) => tag[0] === "t" && tag[1] === "announcement"),
    correctionOf: tags.find((tag) => tag[0] === "t" && tag[1] === "bridge-correction") ? (tags.find((tag) => tag[0] === "e" && tag[3] === "reply")?.[1] ?? null) : null,
    deleted: false,
    contentVersion: 1
  };
}

export function mapMessageToDiscordPayload(message: MessageRecord): Record<string, unknown> {
  return {
    content: message.content,
    embeds: [],
    message_reference: message.replyTo ? { message_id: message.replyTo } : undefined,
    allowed_mentions: { parse: [] }
  };
}

export function mapMessageToNostrTemplate(message: MessageRecord, serverId: string, channelId: string): Record<string, unknown> {
  const tags: string[][] = [["e", channelHash(serverId, channelId), "", "root"]];
  if (message.replyTo) tags.push(["e", message.replyTo, "", "reply"]);
  if (message.announcement) tags.push(["t", "announcement"]);
  if (message.correctionOf) tags.push(["t", "bridge-correction"]);
  for (const attachment of message.attachments) tags.push(["imeta", "url " + attachment.url, "m " + attachment.mime, "size " + String(attachment.size ?? "")]);
  return nostrTemplate(NOSTR_KINDS.message, tags, message.content);
}

export function mapReactionToDiscordPath(room: RoomRecord, reaction: ReactionRecord): string {
  return "/channels/" + String(room.discordId) + "/messages/" + reaction.messageId + "/reactions/" + encodeURIComponent(reaction.emoji) + "/@me";
}

export function mapReactionToNostrTemplate(reaction: ReactionRecord, targetAuthor: string): Record<string, unknown> {
  return nostrTemplate(NOSTR_KINDS.reaction, [["e", reaction.messageId], ["k", "42"], ["p", targetAuthor]], reaction.emoji);
}

export function mapDeletionToNostrTemplate(messageId: string): Record<string, unknown> {
  return nostrTemplate(NOSTR_KINDS.deletion, [["e", messageId]], "deleted");
}

export function mapTypingToNostrTemplate(serverId: string, channelId: string): Record<string, unknown> {
  return nostrTemplate(NOSTR_KINDS.typing, [["e", channelHash(serverId, channelId), "", "root"]], "");
}

export function mapPresenceToNostrTemplate(presence: PresenceRecord): Record<string, unknown> {
  return nostrTemplate(NOSTR_KINDS.voice, [["d", "zellous-presence:status"]], JSON.stringify({ status: presence.status, custom: presence.custom, until: presence.until }));
}

export function mapProfileToNostrTemplate(profile: ProfileRecord): Record<string, unknown> {
  return nostrTemplate(NOSTR_KINDS.profile, [], JSON.stringify({ name: profile.name, picture: profile.avatarUrl, banner: profile.bannerUrl }));
}

export function mapNostrPresenceToPresence(event: Record<string, unknown>): PresenceRecord {
  const data = JSON.parse(String(event.content ?? "{}")) as { status?: string; custom?: string; until?: number };
  return {
    userId: String(event.pubkey),
    status: (data.status as PresenceRecord["status"]) ?? "online",
    custom: data.custom ?? "",
    until: data.until ?? 0,
    voiceChannelId: null,
    muted: false,
    deafened: false,
    speaking: false,
    lastSeen: Number(event.created_at) * 1000
  };
}

export function mapDiscordPresenceToPresence(userId: string, status: string, voiceChannelId: string | null, muted: boolean, deafened: boolean): PresenceRecord {
  const allowed = ["online", "idle", "dnd", "invisible", "offline"];
  return {
    userId,
    status: (allowed.includes(status) ? status : "online") as PresenceRecord["status"],
    custom: "",
    until: 0,
    voiceChannelId,
    muted,
    deafened,
    speaking: false,
    lastSeen: Date.now()
  };
}