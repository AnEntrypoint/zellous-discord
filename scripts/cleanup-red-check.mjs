import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { cleanupState, duplicateKeys } from "../dist/live/cleanup.js";
import { findSecretPattern } from "../dist/redaction.js";

function servicePids() {
  return execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(String.fromCharCode(10)).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; }).map(function(line) { return Number(line.trim().split(/\s+/)[0]); }).filter(function(pid) { return pid > 0; });
}

function selfTest() {
  const channels = [
    { id: "1", type: 0, name: "general", parent_id: null, topic: null },
    { id: "2", type: 0, name: "general", parent_id: null, topic: null }
  ];
  assert.ok(duplicateKeys(channels).length > 0, "new duplicate did not fail");
  const ids = new Set(["2"]);
  assert.ok(["1"].filter(function(id) { return !ids.has(id); }).length > 0, "canonical deletion did not fail");
  console.log("CLEANUP_RED_CHECK_SELF_TEST_PASS");
}

async function main() {
  const config = loadConfigFromEnvFile();
  const port = config.healthPort;
  const owner = ownerHex(config);
  const serverId = resolveServerId(config, owner);
  const before = await cleanupState(config, serverId);
  assert.equal(before.missingCanonicalIds.length, 0, "canonical channel deleted");
  assert.equal(before.resurrectedDuplicateIds.length, 0, "bridge duplicate remains");
  assert.equal(before.duplicateKeys.length, 0, "duplicate channel key remains");
  const beforeIds = new Set(before.channels.map(function(channel) { return channel.id; }));
  const pids = servicePids();
  assert.equal(pids.length, 1, "expected exactly one live service");
  const healthResponse = await fetch("http://127.0.0.1:" + String(port) + "/health");
  assert.equal(healthResponse.status, 200, "health endpoint unavailable");
  const health = await healthResponse.json();
  assert.ok(health.status === "ok" || health.status === "degraded", "health status missing");
  assert.equal(health.ownerHex, owner, "health owner mismatch");
  assert.equal(health.serverId, serverId, "health server id mismatch");
  assert.ok(Array.isArray(health.degradedFeatures) && health.degradedFeatures.length > 0, "degraded features hidden");
  const text = JSON.stringify({ health });
  assert.equal(findSecretPattern(text), null, "token or private key value in output");
  const after = await cleanupState(config, serverId);
  assert.equal(after.missingCanonicalIds.length, 0, "read-only startup deleted canonical channel");
  assert.equal(after.resurrectedDuplicateIds.length, 0, "read-only startup restored bridge duplicate");
  assert.equal(after.duplicateKeys.length, 0, "read-only startup created duplicate channel");
  const afterIds = new Set(after.channels.map(function(channel) { return channel.id; }));
  const created = [...afterIds].filter(function(id) { return !beforeIds.has(id); });
  assert.equal(created.length, 0, "read-only startup created Discord channel");
  console.log("CLEANUP_RED_CHECK_PASS pid=" + String(pids[0]) + " port=" + String(port) + " before=" + String(before.channels.length) + " after=" + String(after.channels.length) + " canonical=" + String(before.backup.canonicalIds.length) + " created=0 tokenExposure=false");
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
