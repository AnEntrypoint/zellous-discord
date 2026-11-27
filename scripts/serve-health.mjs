import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { findSecretPattern, redactText } from "../dist/redaction.js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { emptyVoiceProof, voiceReadiness } from "../dist/voice/readiness.js";

function findSecretPatternName(value) {
  return redactText(value);
}

const port = 8790;
const child = spawn(process.execPath, ["dist/cli.js", "serve"], {
  env: { ...process.env, HEALTH_PORT: String(port), DISCORD_PRIVILEGED_INTENTS: "false", ZDBRIDGE_READ_ONLY: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", function(chunk) { output += chunk.toString(); });
child.stderr.on("data", function(chunk) { output += chunk.toString(); });

await new Promise(function(resolve) { setTimeout(resolve, 5000); });

let response;
try {
  response = await fetch("http://127.0.0.1:" + String(port) + "/health");
} catch (error) {
  child.kill("SIGTERM");
  throw new Error("health fetch failed; redacted service output: " + findSecretPatternName(output).slice(0, 2000));
}
const health = await response.json();
const expectedConfig = loadConfigFromEnvFile(".env", { ...process.env, DISCORD_PRIVILEGED_INTENTS: "false", HEALTH_PORT: String(port) });
assert.equal(response.status, 200);
assert.ok(health.status === "ok" || health.status === "degraded");
assert.equal(health.privilegedIntentsEnabled, expectedConfig.privilegedIntentsEnabled, "privileged-intent source of truth mismatch");
assert.equal(health.gatewayIntents.includes("32768"), expectedConfig.privilegedIntentsEnabled, "gateway intent mismatch");
for (const feature of ["message-content", "presence", "member-list"]) assert.ok(health.degradedFeatures.includes(feature), "hidden privileged-intent failure");
assert.equal(health.voiceTokenCount, 2);
const proofPath = join(expectedConfig.bridgeStateDir, "voice-proof.json");
const proof = existsSync(proofPath) ? JSON.parse(readFileSync(proofPath, "utf8")) : emptyVoiceProof();
const readiness = voiceReadiness(expectedConfig, proof);
assert.equal(health.voiceReflectionComplete, readiness.voiceReflectionComplete);
assert.equal(health.voiceTokenCount, readiness.voiceTokenCount);
assert.equal(health.voiceReadinessReason, readiness.reason);
assert.equal(health.voicePoolState, readiness.voicePoolState);
if (readiness.complete) {
  assert.equal(health.status, "ok");
  assert.equal(health.voiceReflectionComplete, true);
  assert.equal(health.degradedFeatures.length, 0);
} else {
  assert.equal(health.status, "degraded");
  assert.equal(health.voiceReflectionComplete, false);
  assert.ok(health.degradedFeatures.includes("per-user-voice-reflection"));
}
assert.equal(findSecretPattern(output), null);

const pid = child.pid;
child.kill("SIGTERM");
if (child.exitCode === null) {
  await Promise.race([once(child, "exit"), new Promise(function(resolve) { setTimeout(resolve, 2000); })]);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

console.log("SERVE_HEALTH_PASS pid=" + String(pid) + " status=" + health.status + " degraded=" + health.degradedFeatures.join(",") + " tokenExposure=false");