import test from "node:test";
import assert from "node:assert/strict";
import { ALL_ROOM_TYPES, mapDiscordChannelToRoom, mapMessageToNostrTemplate, mapPresenceToNostrTemplate, mapProfileToNostrTemplate, mapReactionToNostrTemplate, mapTypingToNostrTemplate, roomToDiscordCreate, roomToZellousChannel, type DiscordChannelLike } from "../../src/mappers.js";
import { NOSTR_KINDS } from "../../src/nostr.js";

test("all room types map in both directions", () => {
  for (const type of ALL_ROOM_TYPES) {
    const discordType = type === "category" ? 4 : type === "voice" ? 2 : type === "announcement" ? 5 : type === "forum" ? 15 : type === "stage" ? 13 : type === "thread" ? 11 : 0;
    const channel: DiscordChannelLike = { id: "channel-" + type, type: discordType, name: type };
    const room = mapDiscordChannelToRoom(channel, "pubkey:discord", "367741339393327104");
    assert.equal(room.type, type);
    assert.equal(roomToDiscordCreate(room).type, discordType);
    assert.equal(String(roomToZellousChannel(room).type), type);
  }
});

test("message, reaction, typing, presence and profile templates use the pinned kinds", () => {
  const room = mapDiscordChannelToRoom({ id: "channel-1", type: 0, name: "general" }, "pubkey:discord", "367741339393327104");
  const template = mapMessageToNostrTemplate({ messageId: "message-1", discordId: "d1", zellousEventId: "z1", roomId: room.roomId, author: { source: "discord", sourceUserId: "u1", bridgePubkey: null, displayName: "User", avatarUrl: null }, content: "hello", createdAt: 1, editedAt: null, replyTo: null, mentions: [], attachments: [], reactions: [], previews: [], announcement: false, correctionOf: null, deleted: false, contentVersion: 1 }, room.serverId, "channel-1");
  assert.equal(template.kind, NOSTR_KINDS.message);
  assert.equal(mapReactionToNostrTemplate({ messageId: "z1", emoji: "+", userId: "u1", source: "discord", createdAt: 1, removedAt: null }, "author").kind, NOSTR_KINDS.reaction);
  assert.equal(mapTypingToNostrTemplate(room.serverId, "channel-1").kind, NOSTR_KINDS.typing);
  assert.equal(mapPresenceToNostrTemplate({ userId: "u1", status: "online", custom: "", until: 0, voiceChannelId: null, muted: false, deafened: false, speaking: false, lastSeen: 1 }).kind, NOSTR_KINDS.voice);
  assert.equal(mapProfileToNostrTemplate({ userId: "u1", name: "User", avatarUrl: null, bannerUrl: null, accentColor: null, updatedAt: 1 }).kind, NOSTR_KINDS.profile);
});