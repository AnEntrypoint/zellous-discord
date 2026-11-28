import assert from "node:assert/strict";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { DiscordVoicePool } from "../dist/voice/discord.js";
import { discordInventory } from "../dist/live/inventory.js";

const config = loadConfigFromEnvFile();
const pool = new DiscordVoicePool(config);
const probe = await pool.probe();
assert.ok(probe.usable >= 1, "no usable voice identity");
const rooms = await discordInventory(config);
const channel = rooms.find(function(room) { return room.type === "voice" && room.discordId; });
assert.ok(channel, "guild has no voice channel");
const started = Date.now();
try {
  const first = await pool.join(config.discordGuildId, String(channel.discordId), "zellous:pool-check-a", function() {});
  assert.ok(first, "pool refused the first human");
  assert.equal(first.shared, false, "first human reported a shared bot");
  const second = await pool.join(config.discordGuildId, String(channel.discordId), "zellous:pool-check-b", function() {});
  assert.equal(second.identity, first.identity, "second human got another bot");
  assert.equal(second.shared, true, "second human did not share the bot");
  assert.equal(pool.boundIdentities().length, 1, "more than one bot bound");
  assert.equal(pool.leave("zellous:pool-check-a"), null, "bot left while a human remained");
  assert.equal(pool.leave("zellous:pool-check-b"), first.identity, "bot stayed after the last human left");
  assert.equal(pool.boundIdentities().length, 0, "bot still bound");
  console.log("VOICE_POOL_PASS channel=" + String(channel.name) + " identity=" + first.identity + " joinMs=" + String(Date.now() - started) + " usable=" + String(probe.usable) + " invalid=" + String(probe.invalid));
} finally { await pool.close(); }
process.exit(0);
