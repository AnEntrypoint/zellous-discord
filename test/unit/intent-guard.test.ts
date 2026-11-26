import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../../src/config.js";
import { BASE_INTENTS, PRIVILEGED_INTENTS, degradedFeatures, gatewayIntents } from "../../src/adapters/discord.js";

const base = {
  DISCORD_TOKEN: "control-token",
  DISCORD_GUILD_ID: "367741339393327104",
  DISCORD_VOICE_TOKENS: ""
};

test("default gateway excludes disallowed privileged intents", () => {
  const config = loadConfig(base);
  const intents = gatewayIntents(config);
  for (const intent of PRIVILEGED_INTENTS) assert.ok(!intents.includes(intent));
  for (const intent of BASE_INTENTS) assert.ok(intents.includes(intent));
});

test("privileged intents are explicit opt-in", () => {
  const config = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true" });
  const intents = gatewayIntents(config);
  for (const intent of PRIVILEGED_INTENTS) assert.ok(intents.includes(intent));
});

test("degraded features include privileged enrichment and voice pool absence", () => {
  const config = loadConfig(base);
  const features = degradedFeatures(config);
  assert.ok(features.includes("message-content"));
  assert.ok(features.includes("presence"));
  assert.ok(features.includes("member-list"));
  assert.ok(features.includes("per-user-voice-reflection"));
});