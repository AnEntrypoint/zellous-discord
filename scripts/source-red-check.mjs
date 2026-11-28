import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER_HEX } from "../dist/config.js";
import { sourceEvidencePath } from "../dist/live/source.js";
import { findSecretPattern } from "../dist/redaction.js";
import { syntheticDiscordToken } from "./secret-fixtures.mjs";

const nl = String.fromCharCode(10);
const requiredChannelNames = ["inference", "warez-and-wonders", "Rules"];
const iconPrefix = "https://cdn.discordapp.com/icons/367741339393327104/";

function assertSource(result, evidence, log) {
  assert.equal(result.ok, true, "source-of-truth witness did not pass");
  assert.equal(result.owner, OWNER_HEX, "missing owner signature");
  assert.equal(result.surfaces.discordRest, "247420", "Discord REST name is stale");
  for (const [surface, name] of Object.entries(result.surfaces)) {
    assert.equal(name, result.surfaces.discordRest, surface + " disagrees with live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  assert.ok(result.iconSurfaces, "missing guild logo surfaces");
  for (const [surface, icon] of Object.entries(result.iconSurfaces)) {
    assert.equal(icon, result.iconSurfaces.discordRest, surface + " guild logo disagrees");
    assert.ok(String(icon).startsWith(iconPrefix), surface + " guild logo is static or missing");
  }
  assert.equal(result.voiceSurfaces.headingVisible, true, "Zellous voice bridge heading hidden");
  assert.ok(result.voiceSurfaces.discordRest.length > 0, "Discord voice bridge hidden");
  assert.deepEqual(result.voiceSurfaces.browserDom, result.voiceSurfaces.discordRest, "Zellous voice bridge disagrees with Discord");
  assert.equal(result.liveServiceCount, 1, "more than one live service");
  assert.ok(String(result.liveServicePid).length > 0, "missing live service PID");
  assert.equal(result.browser.sendPath, "live-zellous-ui", "witness did not use the live Zellous UI");
  assert.equal(result.browser.cachedOnly, false, "cached-only witness");
  assert.equal(result.browser.domServerNameSource, "dom-body-text", "cached-only DOM server name");
  assert.ok(String(result.browser.url).includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.ok(Array.isArray(result.browser.steps) && result.browser.steps.includes("eval") && result.browser.steps.includes("screenshot"), "live UI browser steps missing");
  assert.ok(String(result.browser.firstBody).includes("screenshot="), "browser screenshot step missing");
  assert.ok(String(result.browser.secondBody).includes("VOICE CHANNELS") === false, "cached-only browser step body");
  const channels = result.channelSurfaces;
  assert.deepEqual(channels.relaySnapshot, channels.discordRest, "relay channel snapshot disagrees");
  assert.deepEqual(channels.cachedChannelMap, channels.discordRest, "cached channel map disagrees");
  assert.equal(channels.discordRest.length, 22, "changed channel count");
  assert.equal(result.channelCount, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(channels.browserDomVisible.includes(name), "browser DOM missing channel " + name);
  assert.equal(evidence.staleNamePresent, false, "browser evidence reports a stale name");
  assert.equal(evidence.domStaleNamePresent, false, "browser DOM shows stale Discord Bridge name");
  assert.equal(evidence.domServerName, "247420", "browser DOM name is stale");
  assert.equal(evidence.domServerNameSource, "dom-body-text", "browser DOM name source is cached-only");
  assert.ok(String(evidence.domServerIcon).startsWith(iconPrefix), "browser DOM guild logo missing");
  assert.equal(evidence.browserCachedOnly, false, "cached-only witness");
  assert.equal(evidence.browserSendPath, "live-zellous-ui", "witness did not use the live Zellous UI");
  assert.equal(evidence.voiceChannelHeadingVisible, true, "browser DOM voice bridge heading hidden");
  assert.ok(Array.isArray(evidence.visibleVoiceChannelNames) && evidence.visibleVoiceChannelNames.length > 0, "browser DOM voice bridge hidden");
  assert.equal(findSecretPattern(JSON.stringify(result) + JSON.stringify(evidence)), null, "secret value in evidence");
  const combined = JSON.stringify(result) + JSON.stringify(evidence) + String(log);
  assert.ok(!combined.includes("Discord Bridge"), "stale Discord Bridge name remains");
  assert.ok(!String(log).includes("Cannot read properties of null (reading 'userId')"), "nullable presence error remains");
  assert.ok(!String(log).includes("Presence: unknown status"), "degraded presence remains");
}

function selfTest() {
  const channelNames = ["Rules", "inference", "warez-and-wonders", ...Array.from({ length: 19 }, function(_, index) { return "channel-" + String(index); })].sort();
  const voiceNames = ["sleep-dungeon-do-not-disturb", "the-room-inside-the-room-inside", "the-room-inside-the-room-inside-the-room-inside"];
  const icon = iconPrefix + "icon.png";
  const iconSurfaces = { discordRest: icon, relayMetadata: icon, relayListing: icon, cachedServers: icon, browserDom: icon };
  const voiceSurfaces = { discordRest: voiceNames, browserDom: voiceNames, headingVisible: true };
  const browser = { url: "https://anentrypoint.github.io/zellous/nostr-chat/", sendPath: "live-zellous-ui", cachedOnly: false, domServerNameSource: "dom-body-text", steps: ["eval", "wait", "eval", "screenshot"], firstSteps: ["eval", "screenshot"], secondSteps: ["eval"], firstBody: "eval=join\nscreenshot=source-discover.png", secondBody: "eval=evidence", screenshot: "source-discover.png" };
  const base = { ok: true, owner: OWNER_HEX, serverId: "server", surfaces: { discordRest: "247420", relayMetadata: "247420", relayListing: "247420", cachedServers: "247420", browserDom: "247420" }, iconSurfaces, channelSurfaces: { discordRest: channelNames, relaySnapshot: channelNames, cachedChannelMap: channelNames, browserDomVisible: channelNames }, voiceSurfaces, channelCount: 22, liveServiceCount: 1, liveServicePid: "1", browser };
  const evidence = { serverName: "247420", domServerName: "247420", domServerNameSource: "dom-body-text", domServerIcon: icon, domStaleNamePresent: false, staleNamePresent: false, browserCachedOnly: false, browserSendPath: "live-zellous-ui", voiceChannelHeadingVisible: true, visibleVoiceChannelNames: voiceNames };
  assertSource(base, evidence, "");
  const cases = [
    [{ ...base, owner: "wrong" }, evidence, "", "wrong author did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, relayMetadata: "Discord Bridge" } }, evidence, "", "stale metadata did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, cachedServers: "Discord Bridge" } }, evidence, "", "stale cached name did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, browserDom: "Discord Bridge" } }, evidence, "", "stale browser name did not fail"],
    [{ ...base, iconSurfaces: { ...iconSurfaces, relayMetadata: "https://example.com/icon.png" } }, evidence, "", "stale metadata logo did not fail"],
    [{ ...base, iconSurfaces: { ...iconSurfaces, relayListing: "https://example.com/icon.png" } }, evidence, "", "stale listing logo did not fail"],
    [{ ...base, iconSurfaces: { ...iconSurfaces, cachedServers: "https://example.com/icon.png" } }, evidence, "", "stale cached logo did not fail"],
    [{ ...base, iconSurfaces: { ...iconSurfaces, browserDom: "https://example.com/icon.png" } }, evidence, "", "missing browser logo did not fail"],
    [{ ...base, iconSurfaces: undefined }, evidence, "", "missing logo surfaces did not fail"],
    [{ ...base, voiceSurfaces: { ...voiceSurfaces, headingVisible: false } }, evidence, "", "hidden voice bridge heading did not fail"],
    [{ ...base, voiceSurfaces: { ...voiceSurfaces, discordRest: [] } }, evidence, "", "hidden Discord voice bridge did not fail"],
    [{ ...base, voiceSurfaces: { ...voiceSurfaces, browserDom: [] } }, evidence, "", "hidden Zellous voice bridge did not fail"],
    [{ ...base, liveServiceCount: 2 }, evidence, "", "more than one live service did not fail"],
    [{ ...base, browser: { ...browser, sendPath: "cached" } }, evidence, "", "cached-only witness did not fail"],
    [{ ...base, browser: { ...browser, cachedOnly: true } }, evidence, "", "cached-only witness did not fail"],
    [{ ...base, browser: { ...browser, domServerNameSource: "localStorage" } }, evidence, "", "cached-only DOM server name did not fail"],
    [{ ...base, browser: { ...browser, url: "https://example.com" } }, evidence, "", "witness without live UI did not fail"],
    [{ ...base, browser: { ...browser, steps: [] } }, evidence, "", "live UI steps missing did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, relaySnapshot: ["inference"] } }, evidence, "", "relay channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, cachedChannelMap: ["inference"] } }, evidence, "", "cached channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, browserDomVisible: ["inference"] } }, evidence, "", "missing DOM channel did not fail"],
    [{ ...base, channelCount: 21 }, evidence, "", "changed channel count did not fail"],
    [base, { ...evidence, staleNamePresent: true }, "", "stale browser evidence did not fail"],
    [base, { ...evidence, domStaleNamePresent: true }, "", "stale browser DOM did not fail"],
    [base, { ...evidence, domServerName: "Discord Bridge" }, "", "stale browser DOM name did not fail"],
    [base, { ...evidence, domServerNameSource: "localStorage" }, "", "cached-only DOM name did not fail"],
    [base, { ...evidence, domServerIcon: "https://example.com/icon.png" }, "", "missing browser logo did not fail"],
    [base, { ...evidence, browserCachedOnly: true }, "", "cached-only witness did not fail"],
    [base, { ...evidence, browserSendPath: "publishChatEvent" }, "", "synthetic witness did not fail"],
    [base, { ...evidence, voiceChannelHeadingVisible: false }, "", "hidden voice bridge heading did not fail"],
    [base, { ...evidence, visibleVoiceChannelNames: [] }, "", "hidden browser voice bridge did not fail"],
    [base, evidence, "Presence: unknown status", "degraded presence did not fail"],
    [base, evidence, "Cannot read properties of null (reading 'userId')", "nullable presence did not fail"],
    [base, { ...evidence, token: syntheticDiscordToken }, "", "secret value did not fail"]
  ];
  for (const [value, ev, log, label] of cases) {
    let threw = false;
    try { assertSource(value, ev, log); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("SOURCE_RED_CHECK_SELF_TEST_PASS cases=" + String(cases.length));
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync("data/source-truth.json", "utf8"));
  const evidence = JSON.parse(readFileSync(sourceEvidencePath(), "utf8"));
  const log = readFileSync(join(scratch, "zellous-discord", "live-service-current.log"), "utf8").split(nl).slice(-500).join(nl);
  assertSource(result, evidence, log);
  console.log("SOURCE_RED_CHECK_PASS name=247420 surfaces=5 icons=5 voice=3 channels=22 stale=0 degradedPresence=0");
}
