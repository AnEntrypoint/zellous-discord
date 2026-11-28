import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER_HEX } from "../dist/config.js";
import { findSecretPattern } from "../dist/redaction.js";
import { syntheticDiscordToken } from "./secret-fixtures.mjs";

const nl = String.fromCharCode(10);
const requiredChannelNames = ["inference", "warez-and-wonders", "Rules"];
const iconPrefix = "https://cdn.discordapp.com/icons/367741339393327104/";

function assertSource(result, log) {
  assert.equal(result.ok, true, "source-of-truth witness did not pass");
  assert.equal(result.owner, OWNER_HEX, "missing owner signature");
  assert.equal(result.surfaces.discordRest, "247420", "Discord REST name is stale");
  for (const [surface, name] of Object.entries(result.surfaces)) {
    assert.equal(name, result.surfaces.discordRest, surface + " disagrees with live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  for (const [surface, icon] of Object.entries(result.iconSurfaces)) {
    assert.equal(icon, result.iconSurfaces.discordRest, surface + " guild logo disagrees");
    assert.ok(String(icon).startsWith(iconPrefix), surface + " guild logo is static or missing");
  }
  assert.ok(result.accepting.length > 0, "no relay serves the server metadata");
  assert.ok(result.staleRelays.length < result.accepting.length, "every accepting relay serves a wrong name or logo");
  for (const relay of result.staleRelays) assert.ok(result.warnings.some(function(warning) { return warning.relay === relay; }), "stale relay " + relay + " is not reported as a warning");
  for (const relay of result.silentRelays) assert.ok(result.warnings.some(function(warning) { return warning.relay === relay; }), "silent relay " + relay + " is not reported as a warning");
  assert.equal(result.voiceSurfaces.headingVisible, true, "Zellous voice bridge heading hidden");
  assert.ok(result.voiceSurfaces.discordRest.length > 0, "Discord voice bridge hidden");
  assert.deepEqual(result.voiceSurfaces.browserDom, result.voiceSurfaces.discordRest, "Zellous voice bridge disagrees with Discord");
  assert.equal(result.liveServiceCount, 1, "more than one live service");
  assert.ok(String(result.liveServicePid).length > 0, "missing live service PID");
  assert.equal(result.browser.sendPath, "live-zellous-ui", "witness did not use the live Zellous UI");
  assert.equal(result.browser.cachedOnly, false, "cached-only witness");
  assert.ok(String(result.browser.url).includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.ok(Array.isArray(result.browser.steps) && result.browser.steps.includes("eval") && result.browser.steps.includes("screenshot") && String(result.browser.firstBody).includes("url=https://anentrypoint.github.io/zellous/nostr-chat/"), "live UI browser steps missing");
  assert.ok(String(result.browser.firstBody).includes("screenshot="), "browser screenshot step missing");
  assert.ok(!String(result.browser.firstBody).includes("zn_servers',JSON.stringify"), "cached-only browser step body");
  assert.ok(result.liveClient && typeof result.liveClient.nameShown === "boolean" && typeof result.liveClient.railLogoRendered === "boolean", "live client result missing");
  if (!result.liveClient.nameShown) assert.ok(result.warnings.some(function(warning) { return warning.surface === "client"; }), "client name mismatch is not reported");
  if (!result.liveClient.railLogoRendered) assert.ok(result.warnings.some(function(warning) { return warning.surface === "client" && /logo/.test(warning.message); }), "missing rail logo is not reported");
  const channels = result.channelSurfaces;
  assert.deepEqual(channels.relaySnapshot, channels.discordRest, "relay channel snapshot disagrees");
  assert.deepEqual(channels.cachedChannelMap, channels.discordRest, "cached channel map disagrees");
  assert.equal(channels.discordRest.length, 22, "changed channel count");
  assert.equal(result.channelCount, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(channels.browserDomVisible.includes(name), "browser DOM missing channel " + name);
  assert.ok(result.rail && Array.isArray(result.rail.missing), "rail result missing");
  assert.equal(result.rail.listed, result.rail.mapped, "short rail: the live client rail lists " + String(result.rail?.listed) + " of " + String(result.rail?.mapped) + " channels");
  assert.deepEqual(result.rail.missing, [], "short rail: the live client rail does not list " + String((result.rail?.missing ?? []).join(",")));
  assert.equal(findSecretPattern(JSON.stringify(result)), null, "secret value in evidence");
  assert.ok(!String(log).includes("Cannot read properties of null (reading 'userId')"), "nullable presence error remains");
  assert.ok(!String(log).includes("Presence: unknown status"), "degraded presence remains");
}

function selfTest() {
  const channelNames = ["Rules", "inference", "warez-and-wonders", ...Array.from({ length: 19 }, function(_, index) { return "channel-" + String(index); })].sort();
  const voiceNames = ["sleep-dungeon-do-not-disturb", "the-room-inside-the-room-inside", "the-room-inside-the-room-inside-the-room-inside"];
  const icon = iconPrefix + "icon.png";
  const relayMetadata = { "wss://a": { name: "247420", icon }, "wss://b": { name: "Discord Bridge", icon: "" }, "wss://c": null };
  const warnings = [{ surface: "relay", relay: "wss://b", message: "serves name Discord Bridge" }, { surface: "relay", relay: "wss://c", message: "serves no server metadata" }, { surface: "client", message: "the live client rail draws no guild logo" }];
  const browser = { url: "https://anentrypoint.github.io/zellous/nostr-chat/", sendPath: "live-zellous-ui", cachedOnly: false, steps: ["eval", "url", "wait", "eval", "screenshot"], firstSteps: ["eval", "url"], secondSteps: ["eval"], firstBody: "eval=clear\nurl=https://anentrypoint.github.io/zellous/nostr-chat/\nscreenshot=source-discover.png", secondBody: "eval=evidence", screenshot: "source-discover.png" };
  const base = { ok: true, owner: OWNER_HEX, serverId: "server", surfaces: { discordRest: "247420", relayMetadata: "247420", relayListing: "247420", cachedServers: "247420" }, iconSurfaces: { discordRest: icon, relayMetadata: icon, relayListing: icon, cachedServers: icon }, relayMetadata, accepting: ["wss://a", "wss://b"], staleRelays: ["wss://b"], silentRelays: ["wss://c"], warnings, liveClient: { nameShown: true, railLogoRendered: false, staleNamePresent: false }, rail: { mapped: 22, listed: 22, missing: [] }, channelSurfaces: { discordRest: channelNames, relaySnapshot: channelNames, cachedChannelMap: channelNames, browserDomVisible: channelNames }, voiceSurfaces: { discordRest: voiceNames, browserDom: voiceNames, headingVisible: true }, channelCount: 22, liveServiceCount: 1, liveServicePid: "1", browser };
  assertSource(base, "");
  const cases = [
    [{ ...base, owner: "wrong" }, "", "wrong author did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, relayMetadata: "Discord Bridge" } }, "", "stale metadata did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, cachedServers: "Discord Bridge" } }, "", "stale cached name did not fail"],
    [{ ...base, iconSurfaces: { ...base.iconSurfaces, relayMetadata: "https://example.com/icon.png" } }, "", "stale metadata logo did not fail"],
    [{ ...base, iconSurfaces: { ...base.iconSurfaces, relayListing: "https://example.com/icon.png" } }, "", "stale listing logo did not fail"],
    [{ ...base, iconSurfaces: { ...base.iconSurfaces, cachedServers: "" } }, "", "missing cached logo did not fail"],
    [{ ...base, accepting: [], staleRelays: [] }, "", "no relay serving metadata did not fail"],
    [{ ...base, accepting: ["wss://b"], staleRelays: ["wss://b"] }, "", "wrong name on every accepting relay did not fail"],
    [{ ...base, warnings: warnings.slice(1) }, "", "unreported stale relay did not fail"],
    [{ ...base, warnings: warnings.filter(function(warning) { return warning.relay !== "wss://c"; }) }, "", "unreported silent relay did not fail"],
    [{ ...base, liveClient: { nameShown: false, railLogoRendered: false, staleNamePresent: false }, warnings: warnings.filter(function(warning) { return warning.surface !== "client"; }) }, "", "unreported client name mismatch did not fail"],
    [{ ...base, warnings: warnings.filter(function(warning) { return warning.surface !== "client"; }) }, "", "unreported missing rail logo did not fail"],
    [{ ...base, liveClient: undefined }, "", "missing live client result did not fail"],
    [{ ...base, voiceSurfaces: { ...base.voiceSurfaces, headingVisible: false } }, "", "hidden voice bridge heading did not fail"],
    [{ ...base, voiceSurfaces: { ...base.voiceSurfaces, discordRest: [] } }, "", "hidden Discord voice bridge did not fail"],
    [{ ...base, voiceSurfaces: { ...base.voiceSurfaces, browserDom: [] } }, "", "hidden Zellous voice bridge did not fail"],
    [{ ...base, liveServiceCount: 2 }, "", "more than one live service did not fail"],
    [{ ...base, browser: { ...browser, sendPath: "cached" } }, "", "cached-only witness did not fail"],
    [{ ...base, browser: { ...browser, cachedOnly: true } }, "", "cached-only witness did not fail"],
    [{ ...base, browser: { ...browser, url: "https://example.com" } }, "", "witness without live UI did not fail"],
    [{ ...base, browser: { ...browser, steps: [] } }, "", "live UI steps missing did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, relaySnapshot: ["inference"] } }, "", "relay channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, cachedChannelMap: ["inference"] } }, "", "cached channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, browserDomVisible: ["inference"] } }, "", "missing DOM channel did not fail"],
    [{ ...base, channelCount: 21 }, "", "changed channel count did not fail"],
    [{ ...base, rail: { mapped: 22, listed: 18, missing: ["forum-discussion", "ideas-that-might-heal-your-soul", "ideas-that-will-ruin-my-life", "longpost-longhouse"] } }, "", "short rail did not fail"],
    [{ ...base, rail: undefined }, "", "missing rail result did not fail"],
    [base, "Presence: unknown status", "degraded presence did not fail"],
    [base, "Cannot read properties of null (reading 'userId')", "nullable presence did not fail"],
    [{ ...base, token: syntheticDiscordToken }, "", "secret value did not fail"]
  ];
  for (const [value, log, label] of cases) {
    let threw = false;
    try { assertSource(value, log); } catch { threw = true; }
    assert.ok(threw, label);
  }
  const clientOnly = { ...base, liveClient: { nameShown: false, railLogoRendered: false, staleNamePresent: true }, warnings: [...warnings, { surface: "client", message: "the live client rail shows Discord Bridge instead of 247420" }] };
  assertSource(clientOnly, "");
  console.log("SOURCE_RED_CHECK_SELF_TEST_PASS cases=" + String(cases.length + 1));
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync("data/source-truth.json", "utf8"));
  const log = readFileSync(join(scratch, "zellous-discord", "live-service-current.log"), "utf8").split(nl).slice(-500).join(nl);
  assertSource(result, log);
  console.log("SOURCE_RED_CHECK_PASS name=247420 acceptingRelays=" + String(result.accepting.length) + " staleRelays=" + String(result.staleRelays.length) + " warnings=" + String(result.warnings.length) + " channels=22");
}
