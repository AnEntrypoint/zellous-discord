import assert from "node:assert/strict";
import { loadConfig } from "../dist/config.js";
import { BASE_INTENTS, PRIVILEGED_INTENTS, degradedFeatures, gatewayIntents } from "../dist/adapters/discord.js";

const base = {
  DISCORD_TOKEN: "control-token",
  DISCORD_GUILD_ID: "367741339393327104",
  DISCORD_VOICE_TOKENS: ""
};

function assertNoPrivilegedIntents(intents, label) {
  for (const intent of PRIVILEGED_INTENTS) assert.ok(!intents.includes(intent), label + " included privileged intent " + String(intent));
}

function assertBaseIntents(intents) {
  for (const intent of BASE_INTENTS) assert.ok(intents.includes(intent), "missing base intent " + String(intent));
}

function assertOptInPrivilegedIntents(intents) {
  for (const intent of PRIVILEGED_INTENTS) assert.ok(intents.includes(intent), "missing opt-in privileged intent " + String(intent));
}

function assertDegradedFeatures(features) {
  for (const feature of ["message-content", "presence", "member-list", "per-user-voice-reflection"]) assert.ok(features.includes(feature), "hidden degradation " + feature);
}

function assertVoiceClaim(features, voiceReflectionComplete) {
  if (features.includes("per-user-voice-reflection")) assert.equal(voiceReflectionComplete, false, "claimed complete voice reflection without a voice pool");
}

function assertHealth(health) {
  assert.equal(health.status, "degraded");
  assert.equal(health.privilegedIntentsEnabled, false);
  assert.ok(Array.isArray(health.degradedFeatures));
  assertDegradedFeatures(health.degradedFeatures);
  assert.equal(health.voiceReflectionComplete, false);
  assert.equal(health.voiceTokenCount, 0);
}

function expectThrow(operation, label) {
  let threw = false;
  try { operation(); } catch { threw = true; }
  assert.ok(threw, label + " did not fail");
}

function selfTest() {
  expectThrow(function() { assertNoPrivilegedIntents([...BASE_INTENTS, ...PRIVILEGED_INTENTS], "default"); }, "disallowed-intent gateway close");
  expectThrow(function() { assertDegradedFeatures(["message-content"]); }, "hidden degradation");
  expectThrow(function() { assertVoiceClaim(["per-user-voice-reflection"], true); }, "voice reflection claim without pool");
  expectThrow(function() { assertHealth({ status: "ok", privilegedIntentsEnabled: true, degradedFeatures: [], voiceReflectionComplete: true, voiceTokenCount: 2 }); }, "hidden health degradation");
  console.log("INTENT_GUARD_SELF_TEST_PASS");
}

function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const defaultConfig = loadConfig(base);
  const defaultIntents = gatewayIntents(defaultConfig);
  assertNoPrivilegedIntents(defaultIntents, "default");
  assertBaseIntents(defaultIntents);
  assert.equal(defaultConfig.privilegedIntentsEnabled, false);

  const optIn = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true" });
  assert.equal(optIn.privilegedIntentsEnabled, true);
  assertOptInPrivilegedIntents(gatewayIntents(optIn));

  const features = degradedFeatures(defaultConfig);
  assertDegradedFeatures(features);
  assertVoiceClaim(features, false);
  assertHealth({ status: "degraded", privilegedIntentsEnabled: false, degradedFeatures: features, voiceReflectionComplete: false, voiceTokenCount: 0 });
  console.log("INTENT_GUARD_PASS baseIntents=" + String(BASE_INTENTS.length) + " privilegedIntents=" + String(PRIVILEGED_INTENTS.length) + " degraded=" + features.join(","));
}

main();