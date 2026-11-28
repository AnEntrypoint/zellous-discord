import assert from "node:assert/strict";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest } from "./discord-rest.mjs";

function assertSessions(health, voiceStates) {
  assert.ok(Array.isArray(health.voiceSessions), "health does not report voice sessions");
  assert.ok(health.voiceSessions.length > 0, "voice bridge hidden: no bot is bound to a voice channel");
  for (const session of health.voiceSessions) {
    assert.ok(session.humanCount > 0, "bot bound to a channel with no human");
    assert.equal(voiceStates.get(session.botUserId), session.channelId, "Discord does not show the bot in channel " + session.channelId);
  }
  assert.equal(health.voiceReflectionComplete, false, "voice reported complete without delivered frames");
}

function selfTest() {
  const health = { voiceSessions: [{ identity: "voice-bot-1", botUserId: "1", channelId: "9", humanCount: 2 }], voiceReflectionComplete: false };
  assertSessions(health, new Map([["1", "9"]]));
  const cases = [
    [{ ...health, voiceSessions: [] }, new Map(), "hidden voice bridge did not fail"],
    [health, new Map([["1", "8"]]), "bot in the wrong channel did not fail"],
    [health, new Map(), "bot absent on Discord did not fail"],
    [{ ...health, voiceSessions: [{ ...health.voiceSessions[0], humanCount: 0 }] }, new Map([["1", "9"]]), "bot without a human did not fail"],
    [{ ...health, voiceReflectionComplete: true }, new Map([["1", "9"]]), "complete without frames did not fail"],
    [{ voiceReflectionComplete: false }, new Map(), "missing sessions did not fail"]
  ];
  for (const [h, states, label] of cases) {
    let threw = false;
    try { assertSessions(h, states); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("VOICE_BRIDGE_SELF_TEST_PASS cases=" + String(cases.length));
}

async function main() {
  const config = loadConfigFromEnvFile();
  const rest = createDiscordRequest(config);
  const response = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health", { signal: AbortSignal.timeout(10000) });
  const health = await response.json();
  const states = new Map();
  for (const session of health.voiceSessions ?? []) {
    const state = await rest("GET", "/guilds/" + config.discordGuildId + "/voice-states/" + session.botUserId).catch(function() { return null; });
    if (state?.channel_id) states.set(String(session.botUserId), String(state.channel_id));
  }
  assertSessions(health, states);
  const output = JSON.stringify({ sessions: health.voiceSessions, discordStates: Object.fromEntries(states) });
  assert.equal(findSecretPattern(output), null, "secret value in output");
  console.log("VOICE_BRIDGE_PASS sessions=" + String(health.voiceSessions.length) + " " + output);
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
