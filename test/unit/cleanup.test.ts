import test from "node:test";
import assert from "node:assert/strict";
import { assertBridgeDuplicates, bridgeCreatedCutoff, channelCreatePayload, duplicateKeys, splitChannels } from "../../src/live/cleanup.js";

function channel(id, name, type = 0) {
  return { id, type, name, parent_id: null, position: 0, topic: null, nsfw: false };
}

test("bridge cutoff separates canonical channels from bridge duplicates", function() {
  const cutoff = bridgeCreatedCutoff();
  const canonical = channel("805320534370943016", "general");
  const duplicate = channel("1575438397944635422", "general");
  assert.ok(BigInt(canonical.id) < cutoff);
  assert.ok(BigInt(duplicate.id) >= cutoff);
  const split = splitChannels([canonical, duplicate]);
  assert.deepEqual(split.canonicalIds, [canonical.id]);
  assert.deepEqual(split.duplicateIds, [duplicate.id]);
});

test("duplicate key detects a bridge-created duplicate", function() {
  const channels = [channel("805320534370943016", "general"), channel("1575438397944635422", "general")];
  assert.deepEqual(duplicateKeys(channels), ["0|general||"]);
  assertBridgeDuplicates([channels[0]], [channels[1]]);
  assert.throws(function() { assertBridgeDuplicates([channels[0]], [channel("1575438397944635423", "unexpected")]); });
});

test("rollback payload preserves channel shape", function() {
  const source = channel("1575438397944635422", "general", 0);
  source.topic = "hello";
  source.permission_overwrites = [{ id: "1", type: 0, allow: "0", deny: "0" }];
  const payload = channelCreatePayload(source);
  assert.equal(payload.name, "general");
  assert.equal(payload.type, 0);
  assert.equal(payload.topic, "hello");
  assert.ok(Array.isArray(payload.permission_overwrites));
}
