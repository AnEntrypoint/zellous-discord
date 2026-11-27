import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { findSecretPattern, redactText } from "../dist/redaction.js";
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
assert.equal(response.status, 200);
assert.equal(health.status, "degraded");
assert.equal(health.privilegedIntentsEnabled, false);
assert.ok(health.degradedFeatures.includes("message-content"));
assert.ok(health.degradedFeatures.includes("presence"));
assert.ok(health.degradedFeatures.includes("member-list"));
assert.ok(health.degradedFeatures.includes("per-user-voice-reflection"));
const readiness = voiceReadiness(loadConfigFromEnvFile(), emptyVoiceProof());
assert.equal(health.voiceReflectionComplete, readiness.voiceReflectionComplete);
assert.equal(health.voiceTokenCount, readiness.voiceTokenCount);
assert.equal(health.voiceReadinessReason, readiness.reason);
assert.equal(health.voicePoolState, readiness.voicePoolState);
assert.equal(health.voiceReflectionComplete, false);
assert.equal(health.privilegedIntentsEnabled, false);
if (readiness.voiceTokenCount === 1) {
  assert.equal(readiness.reason, "VOICE_POOL_INSUFFICIENT");
  assert.notEqual(readiness.reason, "VOICE_POOL_ABSENT");
  assert.equal(readiness.voicePoolState, "insufficient");
}
if (readiness.degraded) assert.ok(health.degradedFeatures.includes("per-user-voice-reflection"));
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