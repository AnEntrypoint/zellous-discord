import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { channelHash } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";

function currentDistFresh() {
  const built = statSync("dist/cli.js").mtimeMs;
  let newest = 0;
  const walk = function(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith(".ts")) newest = Math.max(newest, statSync(child).mtimeMs);
    }
  };
  walk("src");
  return built >= newest;
}

function assertResult(result) {
  assert.equal(result.ok, true, "missing per-channel marker");
  assert.equal(result.rootSource, "kind42-e-root", "active-UI channel fallback");
  assert.equal(result.channelSource, "discord-rest", "channel source is not live Discord REST");
  assert.equal(result.channels.length, 2, "missing a witness channel");
  assert.deepEqual(result.channels.map(function(channel) { return channel.name; }).sort(), ["inference", "warez-and-wonders"], "witness channels are not inference and warez-and-wonders");
  assert.equal(new Set(result.channels.map(function(channel) { return channel.channelId; })).size, 2, "witness channels are not distinct");
  assert.notEqual(result.channels[0].root, result.channels[1].root, "both channels share one root");
  for (const channel of result.channels) {
    assert.equal(channel.root, channelHash(result.serverId, "room-" + channel.channelId), "wrong kind 42 e root");
    assert.equal(channel.ownCount, 1, "marker missing or duplicated in its Discord channel");
    assert.equal(channel.wrongChannelCount, 0, "wrong-channel marker");
    assert.ok(channel.marker.startsWith("zdb-channel-"), "missing per-channel marker");
    assert.ok(String(channel.discordMessageId).length > 0, "missing Discord-origin message ID");
  }
  assert.equal(result.unknownRoot.relayCount, 1, "unknown-root marker was not published to relays");
  assert.equal(result.unknownRoot.discordPostCount, 0, "unknown root posted to Discord");
  assert.equal(result.leftoverMarkerCount ?? 1, 0, "witness marker left behind");
  assert.equal(result.channelCount, 21, "changed channel count");
  assert.equal(result.liveServiceCount, 1, "more than one live service");
  assert.ok(String(result.liveServicePid).length > 0, "missing live service PID");
  assert.equal(result.distFresh, true, "stale dist");
  assert.equal(currentDistFresh(), true, "stale dist");
  if (result.voiceReflectionComplete) assert.ok(result.voiceTokenCount >= 2 && result.voiceFrameCount > 0, "degraded voice reflection falsely marked complete");
  assert.equal(findSecretPattern(JSON.stringify(result)), null, "secret value in output");
  assert.equal(result.secretFound, false, "secret value in output");
}

function selfTest() {
  const serverId = "test-server";
  const channel = function(name, id) { return { name, channelId: id, root: channelHash(serverId, "room-" + id), marker: "zdb-channel-" + name, username: "zdb-user-" + name, discordMessageId: "message-" + name, ownCount: 1, wrongChannelCount: 0 }; };
  const base = { ok: true, serverId, rootSource: "kind42-e-root", channelSource: "discord-rest", channels: [channel("inference", "1"), channel("warez-and-wonders", "2")], unknownRoot: { root: channelHash(serverId, "room-unknown"), marker: "zdb-unknown-x", relayCount: 1, discordPostCount: 0 }, channelCount: 21, leftoverMarkerCount: 0, liveServiceCount: 1, liveServicePid: "1", voiceReflectionComplete: false, voiceTokenCount: 2, voiceFrameCount: 0, distFresh: true, secretFound: false };
  assertResult(base);
  const cases = [
    [{ ...base, ok: false }, "missing marker did not fail"],
    [{ ...base, rootSource: "chat.activeChannelId" }, "active-UI channel fallback did not fail"],
    [{ ...base, channelSource: "hardcoded" }, "hardcoded channel source did not fail"],
    [{ ...base, channels: [base.channels[1]] }, "missing inference marker did not fail"],
    [{ ...base, channels: [base.channels[0], { ...base.channels[1], root: base.channels[0].root }] }, "shared root did not fail"],
    [{ ...base, channels: [base.channels[0], { ...base.channels[1], wrongChannelCount: 1 }] }, "wrong-channel marker did not fail"],
    [{ ...base, channels: [base.channels[0], { ...base.channels[1], ownCount: 2 }] }, "duplicate marker did not fail"],
    [{ ...base, channels: [base.channels[0], { ...base.channels[1], ownCount: 0 }] }, "missing marker did not fail"],
    [{ ...base, unknownRoot: { ...base.unknownRoot, discordPostCount: 1 } }, "unknown root that posts did not fail"],
    [{ ...base, unknownRoot: { ...base.unknownRoot, relayCount: 0 } }, "unknown-root publication missing did not fail"],
    [{ ...base, channelCount: 22 }, "changed channel count did not fail"],
    [{ ...base, leftoverMarkerCount: 1 }, "marker left behind did not fail"],
    [{ ...base, liveServiceCount: 2 }, "more than one live service did not fail"],
    [{ ...base, distFresh: false }, "stale dist did not fail"],
    [{ ...base, voiceReflectionComplete: true, voiceFrameCount: 0 }, "degraded voice falsely marked complete did not fail"],
    [{ ...base, secretFound: true }, "secret value did not fail"]
  ];
  for (const [value, label] of cases) {
    let threw = false;
    try { assertResult(value); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("CHANNEL_MARKER_RED_CHECK_SELF_TEST_PASS cases=" + String(cases.length));
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync(join(scratch, "zellous-discord", "channel-marker-result.json"), "utf8"));
  assertResult(result);
  console.log("CHANNEL_MARKER_RED_CHECK_PASS channels=2 wrongChannel=0 unknownRootPosts=0");
}
