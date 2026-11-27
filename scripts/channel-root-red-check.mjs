import assert from "node:assert/strict";
import { REQUIRED_SERVER_ID } from "../dist/config.js";
import { channelHash } from "../dist/nostr.js";
import { channelRoot, rootChannelMap } from "../dist/live/source.js";
import { mapZellousChannelToRoom } from "../dist/mappers.js";

function roomFor(channelId) {
  return mapZellousChannelToRoom({ id: "room-" + channelId, name: "inference", type: "text" }, REQUIRED_SERVER_ID, "367741339393327104");
}

function assertRoot(room, channelId) {
  assert.equal(room.discordId, channelId, "Zellous room missing Discord source ID");
  const mapping = { allRooms: () => [room] };
  const roots = rootChannelMap(REQUIRED_SERVER_ID, mapping);
  assert.ok(roots.size > 0, "root map empty");
  assert.equal(roots.get(channelHash(REQUIRED_SERVER_ID, "room-" + channelId)), channelId, "wrong channel root");
  assert.equal(roots.get(channelRoot(REQUIRED_SERVER_ID, channelId)), channelId, "wrong channel root helper");
}

function selfTest() {
  const channelId = "805320534370943016";
  const missing = { ...roomFor(channelId), discordId: null };
  let threw = false;
  try { assertRoot(missing, channelId); } catch { threw = true; }
  assert.ok(threw, "missing Discord source ID did not fail");
  const wrong = { ...roomFor(channelId), discordId: "999999999999999999" };
  threw = false;
  try { assertRoot(wrong, channelId); } catch { threw = true; }
  assert.ok(threw, "wrong Discord source ID did not fail");
  console.log("CHANNEL_ROOT_RED_CHECK_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const channelId = "805320534370943016";
  assertRoot(roomFor(channelId), channelId);
  console.log("CHANNEL_ROOT_RED_CHECK_PASS channelId=" + channelId);
}
