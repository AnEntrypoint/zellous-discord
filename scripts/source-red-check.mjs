import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { OWNER_HEX } from "../dist/config.js";
import { sourceEvidencePath } from "../dist/live/source.js";
import { findSecretPattern } from "../dist/redaction.js";

function assertSource(result, evidence, log) {
  assert.equal(result.ok, true, "source-of-truth witness did not pass");
  assert.equal(result.owner, OWNER_HEX, "missing owner signature");
  assert.equal(result.surfaces.discordRest, "247420", "Discord REST name is stale");
  assert.equal(result.surfaces.relayMetadata, "247420", "relay metadata name is stale");
  assert.equal(result.surfaces.relayListing, "247420", "relay listing name is stale");
  assert.equal(result.surfaces.cachedServers, "247420", "cached server name is stale");
  assert.equal(result.surfaces.browserDom, "247420", "browser DOM name is stale");
  assert.equal(findSecretPattern(JSON.stringify(result) + JSON.stringify(evidence)), null, "secret value in evidence");
  const combined = JSON.stringify(result) + JSON.stringify(evidence) + String(log);
  assert.ok(!combined.includes("Discord Bridge"), "stale Discord Bridge name remains");
  assert.ok(!String(log).includes("Cannot read properties of null (reading userId)"), "nullable presence error remains");
  assert.ok(!String(log).includes("Presence: unknown status"), "degraded presence remains");
}

function selfTest() {
  const base = { ok: true, owner: OWNER_HEX, serverId: "server", surfaces: { discordRest: "247420", relayMetadata: "247420", relayListing: "247420", cachedServers: "247420", browserDom: "247420" } };
  const evidence = { serverName: "247420", domServerName: "247420" };
  assertSource(base, evidence, "");
  const cases = [
    [{ ...base, owner: "wrong" }, evidence, "", "wrong author did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, relayMetadata: "Discord Bridge" } }, evidence, "", "stale metadata did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, cachedServers: "Discord Bridge" } }, evidence, "", "stale cached name did not fail"],
    [{ ...base, surfaces: { ...base.surfaces, browserDom: "Discord Bridge" } }, evidence, "", "stale browser name did not fail"],
    [base, evidence, "Presence: unknown status", "degraded presence did not fail"],
    [base, evidence, "Cannot read properties of null (reading userId)", "nullable presence did not fail"],
    [base, { ...evidence, token: "MTIzNDU2Nzg5MDEyMzQ1Njc4OTBhYmNkZWY.ZmFrZXNpZw.ZmFrZXNpZ25hdHVyZWxvbmdlbm91Z2h2YWx1ZQ" }, "", "secret value did not fail"]
  ];
  for (const [value, ev, log, label] of cases) {
    let threw = false;
    try { assertSource(value, ev, log); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("SOURCE_RED_CHECK_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const result = JSON.parse(readFileSync("data/source-truth.json", "utf8"));
  const evidence = JSON.parse(readFileSync(sourceEvidencePath(), "utf8"));
  const log = readFileSync("/config/workspace/tmp/zellous-discord/live-service.log", "utf8").split("
").slice(-500).join("
");
  assertSource(result, evidence, log);
  console.log("SOURCE_RED_CHECK_PASS name=247420 surfaces=5 stale=0 degradedPresence=0");
}
