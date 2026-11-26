import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { bridgeSecretKey, publicKeyHex, resolveServerId } from "../dist/identity.js";
import { discordInventory, liveInventory } from "../dist/live/inventory.js";
import { findSecretPattern } from "../dist/redaction.js";

function ids(rooms) {
  return rooms.map(function(room) { return String(room.discordId); }).sort();
}

function assertNoCreatedChannels(before, after) {
  const beforeSet = new Set(before);
  const created = after.filter(function(id) { return !beforeSet.has(id); });
  assert.equal(created.length, 0, "startup created Discord channels: " + created.join(","));
  assert.equal(after.length, before.length, "Discord channel count changed");
}

function selfTest() {
  let threw = false;
  try { assertNoCreatedChannels(["1", "2"], ["1", "2", "3"]); } catch { threw = true; }
  assert.ok(threw, "channel creation did not fail");
  console.log("SNAPSHOT_RED_CHECK_SELF_TEST_PASS");
}

async function main() {
  if (process.argv.includes("--self-test")) { selfTest(); return; }
  const config = loadConfigFromEnvFile();
  const secretKey = bridgeSecretKey(config);
  const ownerPubkey = publicKeyHex(secretKey);
  const serverId = resolveServerId(config, ownerPubkey);
  const expected = await liveInventory(config, serverId, ownerPubkey);
  assert.equal(expected.ok, true, "expected snapshot does not already exist");
  const before = ids(await discordInventory(config));
  const port = 8792;
  const child = spawn(process.execPath, ["dist/cli.js", "serve"], {
    env: { ...process.env, HEALTH_PORT: String(port), DISCORD_PRIVILEGED_INTENTS: "false", ZDBRIDGE_READ_ONLY: "1" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", function(chunk) { output += chunk.toString(); });
  child.stderr.on("data", function(chunk) { output += chunk.toString(); });
  await new Promise(function(resolve) { setTimeout(resolve, 5000); });
  const response = await fetch("http://127.0.0.1:" + String(port) + "/health");
  const health = await response.json();
  assert.equal(response.status, 200);
  assert.equal(health.status, "degraded");
  assert.equal(health.privilegedIntentsEnabled, false);
  assert.equal(health.voiceReflectionComplete, false);
  assert.equal(findSecretPattern(output), null);
  const pid = child.pid;
  child.kill("SIGTERM");
  if (child.exitCode === null) {
    await Promise.race([once(child, "exit"), new Promise(function(resolve) { setTimeout(resolve, 2000); })]);
    if (child.exitCode === null) { child.kill("SIGKILL"); await once(child, "exit"); }
  }
  const after = ids(await discordInventory(config));
  assertNoCreatedChannels(before, after);
  console.log("SNAPSHOT_RED_CHECK_PASS pid=" + String(pid) + " before=" + String(before.length) + " after=" + String(after.length) + " created=0 tokenExposure=false");
}

await main();