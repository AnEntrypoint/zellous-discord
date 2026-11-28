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

test("one token is a sufficient voice pool that stays degraded until frames flow", function() {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true", DISCORD_VOICE_TOKENS: "token-a" });
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.voiceTokenCount, 1);
  assert.equal(readiness.voicePoolState, "ready");
  assert.equal(readiness.reason, "VOICE_FRAMES_UNPROVEN");
  assert.notEqual(readiness.reason, "VOICE_POOL_ABSENT");
  assert.equal(readiness.voiceReflectionComplete, false);
});

test("token count alone never proves voice reflection", function() {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true", DISCORD_VOICE_TOKENS: "token-a,token-b" });
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.complete, false);
  assert.equal(readiness.reason, "VOICE_FRAMES_UNPROVEN");
});

test("complete voice requires one identity, frames and both directions and allows a mix", function() {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true", DISCORD_VOICE_TOKENS: "token-a" });
  assert.equal(voiceReadiness(config, { identityCount: 1, frameCount: 2, discordToZellousFrames: 2, zellousToDiscordFrames: 0, mixedAudio: true }).complete, false);
  const readiness = voiceReadiness(config, { identityCount: 1, frameCount: 2, discordToZellousFrames: 1, zellousToDiscordFrames: 1, mixedAudio: true });
  assert.equal(readiness.complete, true);
  assert.equal(readiness.voiceReflectionComplete, true);
});
