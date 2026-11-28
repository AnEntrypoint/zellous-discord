import assert from "node:assert/strict";
import { generateSecretKey } from "nostr-tools/pure";
import { loadConfig, OWNER_HEX } from "../dist/config.js";
import { buildOwnerBundle, ownerChannels } from "../dist/live/discover.js";
import { publicKeyHex, resolveServerId } from "../dist/identity.js";

function throwawayConfig() {
  const secret = generateSecretKey();
  const owner = publicKeyHex(secret);
  const config = loadConfig({
    DISCORD_TOKEN: "control-token",
    DISCORD_GUILD_ID: "367741339393327104",
    ZELLOUS_SERVER_OWNER_HEX: owner
  });
  return { config, secret };
}

function sampleRoom(type, id) {
  const now = Date.now();
  return { roomId: "room-" + id, discordId: id, zellousId: id, serverId: "server", guildId: "367741339393327104", type, parentId: null, position: 0, name: type + "-" + id, topic: null, discordType: 0, categoryId: null, channelHash: "hash", nsfw: false, bitrate: null, userLimit: null, rateLimitPerUser: null, permissionOverwrites: [], archived: false, locked: false, autoArchiveDuration: null, invitable: null, contentVersion: 1, tombstone: false, createdAt: now, updatedAt: now, deletedAt: null };
}

function selfTest() {
  const { config, secret } = throwawayConfig();
  const serverId = resolveServerId(config);
  const rooms = [sampleRoom("text", "1")];
  const channels = ownerChannels(rooms);
  assert.ok(channels.some(function(channel) { return channel.type === "text"; }));
  assert.ok(channels.some(function(channel) { return channel.type === "page"; }));
  const events = buildOwnerBundle(config, serverId, rooms, secret, 100, "Live Guild", "https://cdn.discordapp.com/icons/367741339393327104/icon.png");
  assert.equal(events.length, 4);
  assert.equal(events[0].kind, 34550);
  assert.ok(events[1].tags.some(function(tag) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-discover:") === 0; }));
  assert.ok(events[2].tags.some(function(tag) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-roles:") === 0; }));
  assert.ok(events[3].tags.some(function(tag) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-channels:") === 0; }));
  for (const event of events) assert.equal(event.pubkey, config.zellousServerOwnerHex);
  assert.ok(events[0].created_at < events[1].created_at && events[1].created_at < events[2].created_at && events[2].created_at < events[3].created_at);
  const wrong = generateSecretKey();
  let threw = false;
  try { buildOwnerBundle(config, serverId, rooms, wrong, 200, "Live Guild", "https://cdn.discordapp.com/icons/367741339393327104/icon.png"); } catch { threw = true; }
  assert.ok(threw, "wrong pubkey listing did not fail");
  console.log("DISCOVER_RED_CHECK_SELF_TEST_PASS ownerHex=" + OWNER_HEX);
}

if (process.argv.includes("--self-test")) selfTest();
else { selfTest(); console.log("DISCOVER_RED_CHECK_PASS"); }