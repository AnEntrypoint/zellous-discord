import test from "node:test";
import assert from "node:assert/strict";
import { VoicePresenceTracker, zellousVoiceRoomId } from "../../src/voice/presence.js";

const room = { roomId: "zellousa73bcef7c792d36d", channelName: "the-room-inside-the-room-inside", discordId: "1070605940530880562" };

test("zellous voice room id matches the wireweave derivation", function() {
  const serverId = "988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711:discord-367741339393327104";
  assert.equal(zellousVoiceRoomId(serverId, "the-room-inside-the-room-inside"), "zellousa73bcef7c792d36d");
  assert.equal(zellousVoiceRoomId(serverId, "sleep-dungeon-do-not-disturb"), "zellousa0ba8a2b95f8d92a");
});

test("first live presence is a join, heartbeats are not, leave is a leave", function() {
  const tracker = new VoicePresenceTracker(30000);
  assert.equal(tracker.observe(room, "p1", "join", 1000, 1000)?.kind, "join");
  assert.equal(tracker.observe(room, "p1", "heartbeat", 11000, 11000), null);
  assert.equal(tracker.observe(room, "p1", "leave", 12000, 12000)?.kind, "leave");
  assert.equal(tracker.size(), 0);
});

test("stale presence and out-of-order events do not start a reflector", function() {
  const tracker = new VoicePresenceTracker(30000);
  assert.equal(tracker.observe(room, "p1", "heartbeat", 1000, 100000), null);
  assert.equal(tracker.observe(room, "p1", "join", 90000, 100000)?.kind, "join");
  assert.equal(tracker.observe(room, "p1", "join", 80000, 100000), null);
  assert.equal(tracker.observe(room, "p1", "leave", 70000, 100000), null);
  assert.equal(tracker.size(), 1);
});

test("a lapsed participant is swept as a leave and rejoining starts again", function() {
  const tracker = new VoicePresenceTracker(30000);
  tracker.observe(room, "p1", "join", 1000, 1000);
  assert.equal(tracker.sweep(20000).length, 0);
  const leaves = tracker.sweep(40000);
  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].pubkey, "p1");
  assert.equal(tracker.observe(room, "p1", "join", 41000, 41000)?.kind, "join");
});
