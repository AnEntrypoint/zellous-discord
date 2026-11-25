import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig, parseEnvText, SecretString } from "../../src/config.js";

const nl = String.fromCharCode(10);

test("typed config loads secrets as opaque values", () => {
  const config = loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_GUILD_ID: "367741339393327104",
    DISCORD_VOICE_TOKEN_COUNT: "2",
    DISCORD_VOICE_TOKEN_1: "voice-token-1",
    DISCORD_VOICE_TOKEN_2: "voice-token-2"
  });
  assert.equal(config.discordGuildId, "367741339393327104");
  assert.equal(config.voiceIdentityCapacity, 2);
  assert.equal(config.nostrRelays.length, 6);
  assert.equal(String(config.discordToken), "[REDACTED]");
  assert.equal(JSON.stringify({ token: config.discordToken }), JSON.stringify({ token: "[REDACTED]" }));
  assert.equal(new SecretString("value").reveal(), "value");
});

test("config rejects missing voice pool entries", () => {
  assert.throws(() => loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_GUILD_ID: "367741339393327104",
    DISCORD_VOICE_TOKEN_COUNT: "1"
  }), /required/);
});

test("env parser strips quotes and export prefixes", () => {
  const text = ["export A="b"", "C=d", "# ignored"].join(nl);
  assert.deepEqual(parseEnvText(text), { A: "b", C: "d" });
});