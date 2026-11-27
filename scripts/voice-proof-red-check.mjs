import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function assertProof(result) {
  assert.equal(result.ok, true, "missing voice proof");
  assert.equal(result.voiceTokenCount, 2, "two distinct voice identities missing");
  assert.equal(result.privilegedIntentsEnabled, true, "privileged intents not live");
  assert.equal(result.streams, 2, "distinct per-user streams missing");
  assert.ok(result.discordToZellousFrames >= 2, "Discord-origin real Opus frames missing");
  assert.ok(result.zellousToDiscordFrames >= 2, "Zellous-origin real Opus frames missing");
  assert.equal(result.mixedAudio, false, "mixed audio fallback detected");
  assert.equal(result.secretFound ?? false, false, "secret value in output");
  assert.equal(result.healthOk, true, "health is not ok");
  assert.equal(result.voiceReflectionComplete, true, "voice reflection not complete");
  assert.equal(result.degradedFeatureCount, 0, "degraded feature remains");
}

function selfTest() {
  const base = { ok: true, voiceTokenCount: 2, privilegedIntentsEnabled: true, streams: 2, discordToZellousFrames: 4, zellousToDiscordFrames: 4, mixedAudio: false, healthOk: true, voiceReflectionComplete: true, degradedFeatureCount: 0 };
  const cases = [
    [{ ...base, voiceTokenCount: 1 }, "two distinct voice identities missing"],
    [{ ...base, privilegedIntentsEnabled: false }, "privileged intents not live"],
    [{ ...base, streams: 1 }, "distinct per-user streams missing"],
    [{ ...base, discordToZellousFrames: 0 }, "Discord-origin real Opus frames missing"],
    [{ ...base, zellousToDiscordFrames: 0 }, "Zellous-origin real Opus frames missing"],
    [{ ...base, mixedAudio: true }, "mixed audio fallback detected"],
    [{ ...base, secretFound: true }, "secret value in output"],
    [{ ...base, healthOk: false }, "health is not ok"],
    [{ ...base, voiceReflectionComplete: false }, "voice reflection not complete"],
    [{ ...base, degradedFeatureCount: 1 }, "degraded feature remains"]
  ];
  for (const [value, label] of cases) {
    let threw = false;
    try { assertProof(value); } catch { threw = true; }
    assert.ok(threw, label + " did not fail");
  }
  console.log("VOICE_PROOF_RED_CHECK_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
  const result = JSON.parse(readFileSync(join(scratch, "zellous-discord", "voice-proof-result.json"), "utf8"));
  assertProof(result);
  console.log("VOICE_PROOF_RED_CHECK_PASS marker=" + result.marker + " streams=" + String(result.streams));
}
