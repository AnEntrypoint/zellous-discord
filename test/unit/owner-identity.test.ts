import test from "node:test";
import assert from "node:assert/strict";
import { generateSecretKey } from "nostr-tools/pure";
import { loadConfig, OWNER_HEX, REQUIRED_SERVER_ID } from "../../src/config.js";
import { bridgeSecretKey, ownerHex, publicKeyHex, requireOwnerKey, resolveServerId } from "../../src/identity.js";

function throwawayConfig() {
  const secret = generateSecretKey();
  const throwawayOwner = publicKeyHex(secret);
  const config = loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_GUILD_ID: "367741339393327104",
    ZELLOUS_SERVER_OWNER_HEX: throwawayOwner,
    BRIDGE_PRIVATE_KEY_HEX: Buffer.from(secret).toString("hex")
  });
  return { config, secret, throwawayOwner };
}

test("owner constants decode to the required server id", () => {
  assert.equal(OWNER_HEX, "988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711");
  assert.equal(REQUIRED_SERVER_ID, OWNER_HEX + ":discord-367741339393327104");
});

test("throwaway owner key drives identity plumbing", () => {
  const { config, secret, throwawayOwner } = throwawayConfig();
  assert.equal(ownerHex(config), throwawayOwner);
  assert.deepEqual(Array.from(bridgeSecretKey(config)), Array.from(secret));
  assert.equal(publicKeyHex(requireOwnerKey(config)), throwawayOwner);
  assert.equal(resolveServerId(config), throwawayOwner + ":discord-367741339393327104");
});

test("wrong owner key is rejected", () => {
  const { config, throwawayOwner } = throwawayConfig();
  const wrong = loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_GUILD_ID: "367741339393327104",
    ZELLOUS_SERVER_OWNER_HEX: throwawayOwner,
    BRIDGE_PRIVATE_KEY_HEX: "11".repeat(32)
  });
  assert.throws(() => requireOwnerKey(wrong), /does not match/);
});