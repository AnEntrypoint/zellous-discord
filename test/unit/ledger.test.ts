import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Ledger } from "../../src/ledger.js";
import { MappingStore } from "../../src/mapping.js";
import type { MessageRecord, RoomRecord } from "../../src/types.js";

const scratchRoot = "/config/workspace/tmp/zellous-discord/tests";

function makeRoom(id: string): RoomRecord {
  const now = Date.now();
  return {
    roomId: "room-" + id,
    discordId: "discord-" + id,
    zellousId: "zellous-" + id,
    serverId: "pubkey:discord",
    guildId: "367741339393327104",
    type: "text",
    parentId: null,
    position: 0,
    name: "room-" + id,
    topic: null,
    discordType: 0,
    categoryId: null,
    channelHash: "hash-" + id,
    nsfw: false,
    bitrate: null,
    userLimit: null,
    rateLimitPerUser: null,
    permissionOverwrites: [],
    archived: false,
    locked: false,
    autoArchiveDuration: null,
    invitable: null,
    contentVersion: 1,
    tombstone: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  };
}

function makeMessage(id: string): MessageRecord {
  const now = Date.now();
  return {
    messageId: "message-" + id,
    discordId: "discord-message-" + id,
    zellousEventId: "zellous-event-" + id,
    roomId: "room-" + id,
    author: { source: "discord", sourceUserId: "user-" + id, bridgePubkey: null, displayName: "User", avatarUrl: null },
    content: "hello",
    createdAt: now,
    editedAt: null,
    replyTo: null,
    mentions: [],
    attachments: [],
    reactions: [],
    previews: [],
    announcement: false,
    correctionOf: null,
    deleted: false,
    contentVersion: 1
  };
}

test("duplicate canonical events create no second room or message and replay persists", () => {
  const dir = join(scratchRoot, randomUUID());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, "ledger.jsonl");
  const ledger = new Ledger(path);
  const mapping = new MappingStore(ledger);
  const room = makeRoom("one");
  const message = makeMessage("one");
  const firstRoom = mapping.upsertRoom(room, "discord");
  const secondRoom = mapping.upsertRoom(room, "discord");
  const firstMessage = mapping.upsertMessage(message, "discord");
  const secondMessage = mapping.upsertMessage(message, "discord");
  assert.equal(firstRoom.duplicate, false);
  assert.equal(secondRoom.duplicate, true);
  assert.equal(firstMessage.duplicate, false);
  assert.equal(secondMessage.duplicate, true);
  assert.equal(ledger.getState().rooms.size, 1);
  assert.equal(ledger.getState().messages.size, 1);
  assert.equal(mapping.getRoomByDiscordId("discord-one")?.roomId, "room-one");
  assert.equal(mapping.getRoomByZellousId("zellous-one")?.roomId, "room-one");
  const reopened = new Ledger(path);
  assert.equal(reopened.getState().rooms.size, 1);
  assert.equal(reopened.getState().messages.size, 1);
  assert.equal(reopened.hasIdempotencyKey(firstRoom.eventId), false);
  rmSync(dir, { recursive: true, force: true });
});