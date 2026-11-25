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
assert.equal(LIVE_WIREWEAVE_PIN, "2e364df5f45b29e8f5cf6e747a0c2e9781352e0d");

const override = loadConfig({ ...base, ZELLOUS_RELAYS: "wss://one.example,wss://two.example" });
assert.deepEqual(override.nostrRelays, ["wss://one.example", "wss://two.example"]);
assert.equal(override.relaySource, "ZELLOUS_RELAYS");

console.log("CONFIG_CHECK_PASS liveRelays=" + String(LIVE_DEFAULT_RELAYS.length) + " overrideRelays=2");