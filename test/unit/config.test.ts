import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, parseEnvText, SecretString } from "../../src/config.js";

const nl = String.fromCharCode(10);

test("typed config loads the comma-separated voice token pool", () => {
  const config = loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_VOICE_TOKENS: "voice-token-1,voice-token-2",
    DISCORD_GUILD_ID: "367741339393327104"
  });
  assert.equal(config.discordGuildId, "367741339393327104");
  assert.equal(config.voiceIdentityCapacity, 2);
  assert.equal(config.nostrRelays.length, 6);
  assert.equal(String(config.discordToken), "[REDACTED]");
  assert.equal(JSON.stringify({ token: config.discordToken }), JSON.stringify({ token: "[REDACTED]" }));
  assert.equal(new SecretString("value").reveal(), "value");
});

test("config rejects duplicate voice tokens", () => {
  assert.throws(() => loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_VOICE_TOKENS: "same-token,same-token",
    DISCORD_GUILD_ID: "367741339393327104"
  }), /duplicate/);
});

test("env parser strips quotes and export prefixes", () => {
  const text = ["export A="b"", "C=d", "# ignored"].join(nl);
  assert.deepEqual(parseEnvText(text), { A: "b", C: "d" });
});