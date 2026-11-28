import test from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTION_PREFIX, attributionTag, channelRoot, liveClientAuthor, resolveZellousMessage } from "../../src/live/source.js";

const serverId = "test-server";
const inference = "1073958855979057162";
const warez = "805320534370943016";
const pubkey = "5db360ba057d70b60bc3514011c3998e77e8d7ddceaab6ce5a77b5b45371097e";
const roots = new Map<string, string>([
  [channelRoot(serverId, inference), inference],
  [channelRoot(serverId, warez), warez]
]);

function uiTags(channelId: string): string[][] {
  return [["e", channelRoot(serverId, channelId), "", "root"]];
}

test("a live Zellous UI message with only an e root resolves to its canonical Discord channel", function() {
  const target = resolveZellousMessage(uiTags(inference), roots, pubkey);
  assert.equal(target?.discordId, inference);
  assert.equal(target?.root, channelRoot(serverId, inference));
  assert.equal(target?.username, liveClientAuthor(pubkey));
  assert.notEqual(target?.username, "bridge");
});

test("the kind 42 root wins over any active UI channel", function() {
  const target = resolveZellousMessage(uiTags(warez), roots, pubkey);
  assert.equal(target?.discordId, warez);
  assert.notEqual(target?.discordId, inference);
});

test("an unknown root is suppressed fail-closed", function() {
  assert.equal(resolveZellousMessage([["e", "a".repeat(64), "", "root"]], roots, pubkey), null);
  assert.equal(resolveZellousMessage([], roots, pubkey), null);
});

test("a synthetic attribution tag still resolves and a duplicated one fails", function() {
  assert.equal(resolveZellousMessage([...uiTags(inference), attributionTag("zdb-user-x")], roots, pubkey)?.username, "zdb-user-x");
  assert.equal(resolveZellousMessage([...uiTags(inference), ["t", ATTRIBUTION_PREFIX + "one"], ["t", ATTRIBUTION_PREFIX + "two"]], roots, pubkey), null);
});

test("a missing or invalid live client pubkey is suppressed", function() {
  assert.equal(resolveZellousMessage(uiTags(inference), roots, ""), null);
  assert.equal(resolveZellousMessage(uiTags(inference), roots, "not-a-pubkey"), null);
  assert.equal(liveClientAuthor("not-a-pubkey"), "");
});
