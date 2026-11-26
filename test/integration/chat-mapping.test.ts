import test from "node:test";
import assert from "node:assert/strict";
import { channelHash } from "../../src/nostr.js";
import { OWNER_HEX, REQUIRED_SERVER_ID } from "../../src/config.js";

function messageChannelId(roomId: string): string {
  return roomId.replace("room-", "");
}

test("kind 42 root uses owner server id and real channel id", () => {
  const channelId = "123456789012345678";
  assert.equal(messageChannelId("room-" + channelId), channelId);
  assert.equal(channelHash(REQUIRED_SERVER_ID, channelId).length, 64);
  assert.match(REQUIRED_SERVER_ID, new RegExp("^" + OWNER_HEX + ":"));
});