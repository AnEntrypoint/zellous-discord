import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { channelHash } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";
import { channelRoot, liveClientAuthor, visibleDiscordContent } from "../dist/live/source.js";

const ownerHex = "988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711";

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
  assert.equal(result.ok, true, "missing live UI marker");
  assert.equal(result.sendPath, "live-zellous-ui", "synthetic publishChatEvent-only witness");
  assert.equal(result.syntheticOnly, false, "synthetic publishChatEvent-only witness");
  assert.equal(result.publishChatEventUsed, false, "synthetic publishChatEvent-only witness");
  assert.ok(String(result.browser?.url ?? "").includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.equal(result.browser?.domServerName, "247420", "browser server name is stale");
  assert.ok(["dom-element", "dom-body-text", "dom-document-class"].includes(result.browser?.domServerNameSource), "browser DOM server name source is cached-only");
  assert.equal(result.browser?.cachedOnly, false, "cached-only witness");
  assert.equal(result.browser?.serverNameSource, "playwriter-browser-dom", "cached-only witness");
  assert.ok(Array.isArray(result.browser?.firstSteps) && result.browser.firstSteps.includes("type") && result.browser.firstSteps.includes("press") && result.browser.firstSteps.includes("screenshot"), "live UI inference typing steps missing");
  assert.ok(Array.isArray(result.browser?.secondSteps) && result.browser.secondSteps.includes("type") && result.browser.secondSteps.includes("press") && result.browser.secondSteps.includes("eval"), "live UI warez typing steps missing");
  assert.ok(Array.isArray(result.browser?.steps) && result.browser.steps.includes("type") && result.browser.steps.includes("press") && result.browser.steps.includes("screenshot"), "live UI browser steps missing");
  const inference = result.channels.find(function(channel) { return channel.name === "inference"; });
  const warez = result.channels.find(function(channel) { return channel.name === "warez-and-wonders"; });
  assert.ok(inference && warez, "witness channels are not inference and warez-and-wonders");
  assert.ok(String(result.browser?.firstBody ?? "").includes("type=" + inference.marker), "inference marker not typed in the live UI");
  assert.ok(String(result.browser?.firstBody ?? "").includes("press=Enter"), "inference Enter step missing");
  assert.ok(String(result.browser?.firstBody ?? "").includes("inference"), "inference channel click missing");
  assert.ok(String(result.browser?.secondBody ?? "").includes("type=" + warez.marker), "warez marker not typed in the live UI");
  assert.ok(String(result.browser?.secondBody ?? "").includes("press=Enter"), "warez Enter step missing");
  assert.ok(String(result.browser?.secondBody ?? "").includes("warez-and-wonders"), "warez channel click missing");
  assert.ok(!String(result.browser?.firstBody ?? "").includes("publishChatEvent"), "synthetic publishChatEvent-only witness");
  assert.ok(!String(result.browser?.secondBody ?? "").includes("publishChatEvent"), "synthetic publishChatEvent-only witness");
  assert.equal(result.activeUiFallback, false, "active-UI channel fallback");
  assert.equal(result.channels.length, 2, "missing live UI marker");
  assert.deepEqual(result.channels.map(function(channel) { return channel.name; }).sort(), ["inference", "warez-and-wonders"], "witness channels are not inference and warez-and-wonders");
  assert.equal(new Set(result.channels.map(function(channel) { return channel.channelId; })).size, 2, "witness channels are not distinct");
  assert.notEqual(result.channels[0].root, result.channels[1].root, "both channels share one root");
  for (const channel of result.channels) {
    const root = channelHash(result.serverId, "room-" + channel.channelId);
    assert.equal(channel.root, root, "wrong kind 42 e root");
    assert.equal(channel.relayRoot, root, "relay event has the wrong root");
    assert.equal(channel.activeChannelId, "room-" + channel.channelId, "active-UI channel fallback");
    assert.equal(channel.placeholder, "Message #" + channel.name, "message input is not bound to the channel");
    assert.equal(channel.domVisible, true, "marker not visible in the live Zellous UI");
    assert.equal(channel.typedInDom, true, "marker not typed in the live Zellous UI DOM");
    assert.equal(channel.pressedEnter, true, "Enter press evidence missing");
    assert.ok(String(channel.marker).startsWith("zdb-ui-"), "missing live UI marker");
    assert.equal(String(channel.uiEventId).length, 64, "missing live UI event ID");
    assert.ok(/^[0-9a-f]{64}$/.test(String(channel.uiPubkey)), "missing live UI pubkey");
    assert.notEqual(String(channel.uiPubkey), ownerHex, "relay event was signed by the synthetic owner-key witness");
    assert.equal(channel.username, liveClientAuthor(String(channel.uiPubkey)), "wrong live UI author");
    assert.equal(channel.discordContent, visibleDiscordContent(channel.username, channel.marker), "wrong visible attribution");
    assert.equal(channel.ownCount, 1, "marker missing or duplicated in its Discord channel");
    assert.equal(channel.wrongChannelCount, 0, "wrong-channel marker");
    assert.equal(channel.relayCount, 1, "relay event missing or duplicated");
    assert.equal(channel.syntheticTagCount, 0, "relay event carries synthetic witness tags");
    assert.ok(String(channel.discordMessageId).length > 0, "missing Discord message ID");
  }
  assert.equal(result.unknownRoot?.suppressed, true, "unknown root is not fail-closed");
  assert.equal(result.unknownRoot?.discordPostCount, 0, "unknown root posted to Discord");
  assert.equal(result.leftoverMarkerCount ?? 1, 0, "witness marker left behind");
  assert.equal(result.channelCount, 21, "changed channel count");
  assert.equal(result.liveServiceCount, 1, "more than one live service");
  assert.ok(String(result.liveServicePid).length > 0, "missing live service PID");
  assert.equal(result.distFresh, true, "stale dist");
  assert.equal(currentDistFresh(), true, "stale dist");
  if (result.voiceReflectionComplete) assert.ok(result.voiceTokenCount >= 1 && result.voiceFrameCount > 0, "degraded voice reflection falsely marked complete");
  assert.equal(findSecretPattern(JSON.stringify(result)), null, "secret value in output");
  assert.equal(result.secretFound, false, "secret value in output");
}

function selfTest() {
  const serverId = "test-server";
  const pubkey = "5db360ba057d70b60bc3514011c3998e77e8d7ddceaab6ce5a77b5b45371097e";
  const markers = { inference: "zdb-ui-inference-x", "warez-and-wonders": "zdb-ui-warez-x" };
  const nl = String.fromCharCode(10);
  const channel = function(name, id) {
    const marker = markers[name];
    const username = liveClientAuthor(pubkey);
    return { name, channelId: id, root: channelRoot(serverId, id), marker, uiEventId: "a".repeat(64), uiPubkey: pubkey, username, discordMessageId: "message-" + name, discordContent: visibleDiscordContent(username, marker), ownCount: 1, wrongChannelCount: 0, relayCount: 1, relayRoot: channelRoot(serverId, id), syntheticTagCount: 0, activeChannelId: "room-" + id, placeholder: "Message #" + name, domVisible: true, typedInDom: true, pressedEnter: true };
  };
  const firstBody = ["eval=join", "wait=1500", "eval=cacheName", "eval=channelClick(\"inference\")", "wait=2500", "eval=focusInput", "type=" + markers.inference, "press=Enter", "wait=3500", "eval=capture", "screenshot=ui-discover.png"].join(nl);
  const secondBody = ["eval=channelClick(\"warez-and-wonders\")", "wait=2500", "eval=focusInput", "type=" + markers["warez-and-wonders"], "press=Enter", "wait=3500", "eval=capture", "eval=finalEvidence"].join(nl);
  const firstSteps = ["eval", "wait", "eval", "eval", "wait", "eval", "type", "press", "wait", "eval", "screenshot"];
  const secondSteps = ["eval", "wait", "eval", "type", "press", "wait", "eval", "eval"];
  const base = { ok: true, serverId, sendPath: "live-zellous-ui", syntheticOnly: false, publishChatEventUsed: false, browser: { url: "https://anentrypoint.github.io/zellous/nostr-chat/", domServerName: "247420", domServerNameSource: "dom-body-text", cachedServerName: "247420", cachedOnly: false, serverNameSource: "playwriter-browser-dom", screenshot: "ui-discover.png", firstSteps, secondSteps, steps: firstSteps.concat(secondSteps), firstBody, secondBody }, channels: [channel("inference", "1073958855979057162"), channel("warez-and-wonders", "805320534370943016")], unknownRoot: { root: "b".repeat(64), suppressed: true, discordPostCount: 0 }, activeUiFallback: false, leftoverMarkerCount: 0, channelCount: 21, liveServiceCount: 1, liveServicePid: "1", voiceReflectionComplete: false, voiceTokenCount: 2, voiceFrameCount: 0, distFresh: true, secretFound: false };
  assertResult(base);
  const withChannel = function(patch) { return { ...base, channels: [{ ...base.channels[0], ...patch }, base.channels[1]] }; };
  const cases = [
    [{ ...base, ok: false }, "missing marker did not fail"],
    [{ ...base, sendPath: "publishChatEvent" }, "synthetic publishChatEvent-only witness did not fail"],
    [{ ...base, syntheticOnly: true }, "synthetic-only witness did not fail"],
    [{ ...base, publishChatEventUsed: true }, "publishChatEvent use did not fail"],
    [{ ...base, browser: { ...base.browser, url: "https://example.com" } }, "witness without the live UI did not fail"],
    [{ ...base, browser: { ...base.browser, domServerName: "Discord Bridge" } }, "stale browser name did not fail"],
    [{ ...base, browser: { ...base.browser, domServerNameSource: "localStorage" } }, "cached-only DOM server name did not fail"],
    [{ ...base, browser: { ...base.browser, cachedOnly: true } }, "cached-only witness did not fail"],
    [{ ...base, browser: { ...base.browser, serverNameSource: "cached" } }, "cached-only witness did not fail"],
    [{ ...base, browser: { ...base.browser, firstSteps: [] } }, "missing inference type/press steps did not fail"],
    [{ ...base, browser: { ...base.browser, secondSteps: [] } }, "missing warez type/press steps did not fail"],
    [{ ...base, browser: { ...base.browser, steps: [] } }, "missing combined browser steps did not fail"],
    [{ ...base, browser: { ...base.browser, firstBody: "eval=publishChatEvent()" } }, "synthetic publishChatEvent in first body did not fail"],
    [{ ...base, browser: { ...base.browser, secondBody: "eval=publishChatEvent()" } }, "synthetic publishChatEvent in second body did not fail"],
    [{ ...base, browser: { ...base.browser, firstBody: firstBody.replace("type=" + markers.inference, "eval=cached") } }, "missing inference type step did not fail"],
    [{ ...base, browser: { ...base.browser, secondBody: secondBody.replace("type=" + markers["warez-and-wonders"], "eval=cached") } }, "missing warez type step did not fail"],
    [{ ...base, browser: { ...base.browser, firstBody: firstBody.replace("press=Enter", "wait=100") } }, "missing inference Enter step did not fail"],
    [{ ...base, browser: { ...base.browser, secondBody: secondBody.replace("press=Enter", "wait=100") } }, "missing warez Enter step did not fail"],
    [{ ...base, activeUiFallback: true }, "active-UI fallback did not fail"],
    [{ ...base, channels: [base.channels[1]] }, "missing inference marker did not fail"],
    [withChannel({ activeChannelId: "room-805320534370943016" }), "active-UI channel fallback did not fail"],
    [withChannel({ placeholder: "Message #warez-and-wonders" }), "wrong message input did not fail"],
    [withChannel({ domVisible: false }), "marker not visible in live UI DOM did not fail"],
    [withChannel({ typedInDom: false }), "marker not typed in live UI DOM did not fail"],
    [withChannel({ pressedEnter: false }), "missing Enter press evidence did not fail"],
    [withChannel({ uiPubkey: ownerHex }), "synthetic owner-key event did not fail"],
    [withChannel({ uiEventId: "short" }), "missing live UI event ID did not fail"],
    [withChannel({ username: "bridge" }), "generic bridge actor did not fail"],
    [withChannel({ syntheticTagCount: 1 }), "synthetic witness tag did not fail"],
    [withChannel({ relayRoot: "b".repeat(64) }), "wrong relay root did not fail"],
    [withChannel({ wrongChannelCount: 1 }), "wrong-channel marker did not fail"],
    [withChannel({ ownCount: 0 }), "missing marker did not fail"],
    [withChannel({ ownCount: 2 }), "duplicate marker did not fail"],
    [withChannel({ relayCount: 2 }), "duplicate relay event did not fail"],
    [withChannel({ discordContent: "bare" }), "missing visible attribution did not fail"],
    [{ ...base, unknownRoot: { ...base.unknownRoot, suppressed: false } }, "unknown root not fail-closed did not fail"],
    [{ ...base, unknownRoot: { ...base.unknownRoot, discordPostCount: 1 } }, "unknown root post did not fail"],
    [{ ...base, leftoverMarkerCount: 1 }, "marker left behind did not fail"],
    [{ ...base, channelCount: 22 }, "changed channel count did not fail"],
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
  console.log("UI_MARKER_RED_CHECK_SELF_TEST_PASS cases=" + String(cases.length));
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync(join(scratch, "zellous-discord", "ui-marker-result.json"), "utf8"));
  assertResult(result);
  console.log("UI_MARKER_RED_CHECK_PASS sendPath=live-zellous-ui channels=2 wrongChannel=0 unknownRootPosts=0");
}
