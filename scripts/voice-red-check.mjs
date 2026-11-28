import assert from "node:assert/strict";
import { loadConfig, loadConfigFromEnvFile } from "../dist/config.js";
import { emptyVoiceProof, voiceReadiness } from "../dist/voice/readiness.js";
import { BridgeEchoStore } from "../dist/sync/echo.js";
import { VoiceWorkerPool } from "../dist/voice/pool.js";
import { AudioRouter } from "../dist/voice/router.js";

function frame(voiceId, direction, marker) {
  return { voiceId, direction, opusPayload: Buffer.from("frame-" + String(marker)).toString("base64"), ssrc: marker, sequence: marker, timestamp: marker, sampleRate: 48000, channels: 2, codec: "opus", marker: marker === 0 };
}

function assertDegraded(config, proof) {
  const readiness = voiceReadiness(config, proof);
  assert.equal(readiness.complete, false);
  assert.equal(readiness.voiceReflectionComplete, false);
  assert.equal(readiness.degraded, true);
  assert.ok(readiness.reason);
  return readiness;
}

function assertFrameIsolation() {
  const router = new AudioRouter();
  router.ensure("user-a", "discord-to-zellous");
  router.ensure("user-b", "discord-to-zellous");
  router.write(frame("user-a", "discord-to-zellous", 1));
  router.write(frame("user-b", "discord-to-zellous", 2));
  router.setMuted("user-a", true);
  assert.equal(router.write(frame("user-a", "discord-to-zellous", 3)), false);
  assert.equal(router.write(frame("user-b", "discord-to-zellous", 4)), true);
  assert.equal(router.frames("user-a").length, 1);
  assert.equal(router.frames("user-b").length, 2);
  router.close();
}

function assertWorkerIsolation() {
  const pool = new VoiceWorkerPool();
  pool.start("worker-a", "discord-to-zellous");
  pool.start("worker-b", "zellous-to-discord");
  pool.send("worker-a", frame("user-a", "discord-to-zellous", 1));
  pool.send("worker-b", frame("user-b", "zellous-to-discord", 2));
  assert.equal(pool.frames("worker-a").length, 0);
  assert.equal(pool.routedFrames().length, 2);
  return pool;
}

function assertEchoStore() {
  const store = new BridgeEchoStore("/config/workspace/tmp/zellous-discord/voice-red-check");
  store.rememberDiscord("discord-native-id");
  store.rememberZellous("zellous-native-id");
  store.rememberNonce("zdb-native-id");
  assert.equal(store.isDiscord("discord-native-id"), true);
  assert.equal(store.isZellous("zellous-native-id"), true);
  assert.equal(store.isNonce("zdb-native-id"), true);
  assert.equal(store.isDiscord("unrelated"), false);
}

function expectThrow(operation, label) {
  let threw = false;
  try { operation(); } catch { threw = true; }
  assert.ok(threw, label + " did not fail");
}

function selfTest() {
  expectThrow(function() { assertFrameIsolation(); const router = new AudioRouter(); router.ensure("user-a", "discord-to-zellous"); router.setMuted("user-a", true); assert.equal(router.write(frame("user-a", "discord-to-zellous", 1)), true); }, "muted frame isolation");
  expectThrow(function() { const pool = assertWorkerIsolation(); assert.equal(pool.workerCount(), 1); }, "one identity claiming N users");
  expectThrow(function() { const config = loadConfigFromEnvFile(); const proof = { identityCount: 1, frameCount: 4, discordToZellousFrames: 4, zellousToDiscordFrames: 0, mixedAudio: true }; assert.equal(voiceReadiness(config, proof).complete, true); }, "one-direction claim");
  const one = loadConfig({ DISCORD_TOKEN: "control-token", DISCORD_GUILD_ID: "367741339393327104", DISCORD_VOICE_TOKENS: "token-a" });
  const oneReadiness = voiceReadiness(one, emptyVoiceProof());
  assert.equal(oneReadiness.reason, "PRIVILEGED_INTENTS_ABSENT");
  assert.equal(oneReadiness.voicePoolState, "ready");
  assert.notEqual(oneReadiness.reason, "VOICE_POOL_ABSENT");
  console.log("VOICE_RED_CHECK_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const config = loadConfigFromEnvFile();
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.complete, false);
  assert.equal(readiness.voiceReflectionComplete, false);
  assert.equal(readiness.reason, "VOICE_FRAMES_UNPROVEN");
  assertFrameIsolation();
  const pool = assertWorkerIsolation();
  await pool.stopAll();
  assertEchoStore();
  console.log("VOICE_RED_CHECK_PASS reason=" + String(readiness.reason) + " voiceTokenCount=" + String(readiness.voiceTokenCount) + " voiceReflectionComplete=false");
}
