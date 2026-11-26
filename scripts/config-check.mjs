import assert from "node:assert/strict";
import { loadConfig, LIVE_DEFAULT_RELAYS, LIVE_WIREWEAVE_PIN } from "../dist/config.js";

const base = {
  DISCORD_TOKEN: "control-token",
  DISCORD_GUILD_ID: "367741339393327104",
  DISCORD_VOICE_TOKENS: ""
};

const config = loadConfig(base);
assert.deepEqual(config.nostrRelays, LIVE_DEFAULT_RELAYS);
assert.equal(config.relaySource, "live-pages-default");
assert.equal(config.privilegedIntentsEnabled, false);
assert.equal(LIVE_WIREWEAVE_PIN, "5d451241587181e471e263f44db993ba8e2d5764");

const override = loadConfig({ ...base, ZELLOUS_RELAYS: "wss://one.example,wss://two.example" });
assert.deepEqual(override.nostrRelays, ["wss://one.example", "wss://two.example"]);
assert.equal(override.relaySource, "ZELLOUS_RELAYS");

const privileged = loadConfig({ ...base, DISCORD_PRIVILEGED_INTENTS: "true" });
assert.equal(privileged.privilegedIntentsEnabled, true);

console.log("CONFIG_CHECK_PASS liveRelays=4 overrideRelays=2 privilegedOptIn=false");