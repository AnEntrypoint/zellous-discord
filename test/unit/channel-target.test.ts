import test from "node:test";
import assert from "node:assert/strict";
import { discordChannelId } from "../../src/live/source.js";

const inference = "1073958855979057162";
const warez = "805320534370943016";

test("canonical kind 42 root target wins over a stale duplicate room", function() {
  const roomId = "room-" + inference;
  const canonical = { discordId: inference };
  const stale = { discordId: "discord-room-" + inference };
  assert.equal(discordChannelId(roomId, canonical, stale), inference);
  assert.equal(discordChannelId(roomId, null, stale), inference);
  assert.equal(discordChannelId(roomId, null, null), inference);
  assert.equal(discordChannelId("room-" + warez, null, { discordId: warez }), warez);
});

test("a stale duplicate room cannot redirect inference to warez", function() {
  const roomId = "room-" + inference;
  const stale = { discordId: "discord-room-" + inference };
  assert.notEqual(discordChannelId(roomId, null, stale), warez);
  assert.notEqual(discordChannelId("room-discord-room-" + inference, { discordId: inference }, stale), warez);
  assert.equal(discordChannelId("room-discord-room-" + inference, { discordId: inference }, stale), inference);
});
