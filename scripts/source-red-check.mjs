import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OWNER_HEX } from "../dist/config.js";
import { sourceEvidencePath } from "../dist/live/source.js";
import { findSecretPattern } from "../dist/redaction.js";
import { syntheticDiscordToken } from "./secret-fixtures.mjs";

const nl = String.fromCharCode(10);
const requiredChannelNames = ["inference", "warez-and-wonders", "Rules"];

function assertSource(result, evidence, log) {
  assert.equal(result.ok, true, "source-of-truth witness did not pass");
  assert.equal(result.owner, OWNER_HEX, "missing owner signature");
  assert.equal(result.surfaces.discordRest, "247420", "Discord REST name is stale");
  for (const [surface, name] of Object.entries(result.surfaces)) {
    assert.equal(name, result.surfaces.discordRest, surface + " disagrees with live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  const channels = result.channelSurfaces;
  assert.deepEqual(channels.relaySnapshot, channels.discordRest, "relay channel snapshot disagrees");
  assert.deepEqual(channels.cachedChannelMap, channels.discordRest, "cached channel map disagrees");
  assert.equal(channels.discordRest.length, 22, "changed channel count");
  assert.equal(result.channelCount, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(channels.browserDomVisible.includes(name), "browser DOM missing channel " + name);
  assert.equal(evidence.staleNamePresent, false, "browser evidence reports a stale name");
  assert.equal(evidence.domServerName, "247420", "browser DOM name is stale");
  assert.equal(findSecretPattern(JSON.stringify(result) + JSON.stringify(evidence)), null, "secret value in evidence");
  const combined = JSON.stringify(result) + JSON.stringify(evidence) + String(log);
  assert.ok(!combined.includes("Discord Bridge"), "stale Discord Bridge name remains");
  assert.ok(!String(log).includes("Cannot read properties of null (reading 'userId')"), "nullable presence error remains");
  assert.ok(!String(log).includes("Presence: unknown status"), "degraded presence remains");
}

function selfTest() {
  const channelNames = ["Rules", "inference", "warez-and-wonders", ...Array.from({ length: 19 }, function(_, index) { return "channel-" + String(index); })].sort();
  const base = { ok: true, owner: OWNER_HEX, serverId: "server", surfaces: { discordRest: "247420", relayMetadata: "247420", relayListing: "247420", cachedServers: "247420", browserDom: "247420" }, channelSurfaces: { discordRest: channelNames, relaySnapshot: channelNames, cachedChannelMap: channelNames, browserDomVisible: channelNames }, channelCount: 22 };
  const evidence = { serverName: "247420", domServerName: "247420", staleNamePresent: false };
  assertSource(base, evidence, "");
  const cases = [
    [{ ...base, owner: "wrong" }, evidence, "", "wrong author did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, relayMetadata: "Discord Bridge" } }, evidence, "", "stale metadata did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, cachedServers: "Discord Bridge" } }, evidence, "", "stale cached name did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, browserDom: "Discord Bridge" } }, evidence, "", "stale browser name did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, relaySnapshot: ["inference"] } }, evidence, "", "relay channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, cachedChannelMap: ["inference"] } }, evidence, "", "cached channel disagreement did not fail"],
    [{ ...base, channelSurfaces: { ...base.channelSurfaces, browserDomVisible: ["inference"] } }, evidence, "", "missing DOM channel did not fail"],
    [{ ...base, channelCount: 21 }, evidence, "", "changed channel count did not fail"],
    [base, { ...evidence, staleNamePresent: true }, "", "stale browser evidence did not fail"],
    [base, { ...evidence, domServerName: "Discord Bridge" }, "", "stale browser DOM name did not fail"],
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
  console.log("SOURCE_RED_CHECK_PASS name=247420 surfaces=5 channels=22 stale=0 degradedPresence=0");
}
