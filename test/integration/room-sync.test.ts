import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createCanonicalEvent } from "../../src/canonical.js";
import { Logger } from "../../src/logger.js";
import { Ledger } from "../../src/ledger.js";
import { MappingStore } from "../../src/mapping.js";
import { ALL_ROOM_TYPES } from "../../src/mappers.js";
import { MockAdapter } from "../../src/adapters/mock.js";
import { SyncEngine } from "../../src/sync/engine.js";
import type { CanonicalEvent, RoomRecord } from "../../src/types.js";

const scratchRoot = "/config/workspace/tmp/zellous-discord/tests";
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function makeEngine() {
  const dir = join(scratchRoot, randomUUID());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ledger = new Ledger(join(dir, "ledger.jsonl"));
  const mapping = new MappingStore(ledger);
  const logger = new Logger("error", () => {});
  const discord = new MockAdapter("discord");
  const zellous = new MockAdapter("zellous");
  const engine = new SyncEngine(discord, zellous, ledger, mapping, logger);
  return { dir, ledger, mapping, discord, zellous, engine };
}

function replayEvent(room: RoomRecord, version: number): CanonicalEvent {
  return createCanonicalEvent({
    schemaVersion: 1,
    source: "discord",
    sourceId: room.discordId ?? room.roomId,
    operation: "room.rename",
    version,
    occurredAt: Date.now() + version,
    actor: { source: "discord", sourceUserId: "user", bridgePubkey: null, displayName: "User", avatarUrl: null },
    room: { roomId: room.roomId, discordId: room.discordId, zellousId: room.zellousId, serverId: room.serverId, guildId: room.guildId, type: room.type, parentId: room.parentId, position: room.position, name: room.name, topic: room.topic },
    payload: { room: { ...room, name: "version-" + String(version), contentVersion: version } },
    suppressionKey: null,
    tracing: ["discord"]
  });
}

test("every mapped room type and mutation converges in both systems", async () => {
  const context = makeEngine();
  await context.engine.start();
  for (const type of ALL_ROOM_TYPES) await context.discord.createRoom(type, "room-" + type);
  await tick();
  assert.equal(context.discord.liveRooms().length, 7);
  assert.equal(context.zellous.liveRooms().length, 7);
  for (const type of ALL_ROOM_TYPES) assert.ok(context.zellous.liveRooms().some((room) => room.type === type));
  const first = context.discord.liveRooms()[0];
  await context.discord.renameRoom(first.roomId, "renamed");
  await context.discord.reorderRoom(first.roomId, 3);
  await context.discord.reparentRoom(first.roomId, "parent-1");
  await context.discord.archiveRoom(first.roomId, true);
  await context.discord.deleteRoom(first.roomId);
  const recreated = await context.discord.createRoom(first.type, first.name);
  await tick();
  assert.equal(context.zellous.room(first.roomId)?.tombstone, true);
  assert.equal(context.zellous.room(recreated.roomId)?.tombstone, false);
  assert.equal(context.zellous.liveRooms().length, 7);
  const replayed = [replayEvent(recreated, 3), replayEvent(recreated, 1), replayEvent(recreated, 2)];
  await context.engine.replay(replayed);
  await tick();
  assert.equal(context.zellous.room(recreated.roomId)?.name, "version-3");
  context.zellous.disconnect();
  context.discord.disconnect();
  await context.discord.createRoom("text", "during-outage");
  await context.discord.setTyping("user-1");
  await context.engine.restart();
  await tick();
  assert.equal(context.discord.liveRooms().length, 8);
  assert.equal(context.zellous.liveRooms().length, 8);
  assert.equal(context.ledger.getState().rooms.size >= 9, true);
  await context.engine.stop();
  rmSync(context.dir, { recursive: true, force: true });
});