import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/config.js";
import { emptyVoiceProof, voiceReadiness } from "../../src/voice/readiness.js";

const base = { DISCORD_TOKEN: "control-token", DISCORD_GUILD_ID: "367741339393327104", DISCORD_VOICE_TOKENS: "" };

test("zero tokens stay honestly degraded", function() {
  const readiness = voiceReadiness(loadConfig(base), emptyVoiceProof());
  assert.equal(readiness.complete, false);
  assert.equal(readiness.voiceReflectionComplete, false);
  assert.equal(readiness.reason, "VOICE_POOL_ABSENT");
});

test("one token reports an insufficient voice pool", function() {
  const config = loadConfig({ ...base, DISCORD_VOICE_TOKENS: "token-a" });
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.voiceTokenCount, 1);
  assert.equal(readiness.voicePoolState, "insufficient");
  assert.equal(readiness.reason, "VOICE_POOL_INSUFFICIENT");
  assert.notEqual(readiness.reason, "VOICE_POOL_ABSENT");
  assert.equal(readiness.voiceReflectionComplete, false);
});

test("token count alone never proves voice reflection", function() {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true", DISCORD_VOICE_TOKENS: "token-a,token-b" });
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.complete, false);
  assert.equal(readiness.reason, "VOICE_FRAMES_UNPROVEN");
});

test("complete voice requires identities, frames and both directions", function() {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true", DISCORD_VOICE_TOKENS: "token-a,token-b" });
  const readiness = voiceReadiness(config, { identityCount: 2, frameCount: 2, discordToZellousFrames: 1, zellousToDiscordFrames: 1 });
  assert.equal(readiness.complete, true);
  assert.equal(readiness.voiceReflectionComplete, true);
});
