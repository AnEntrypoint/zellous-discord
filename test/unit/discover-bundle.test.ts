import test from "node:test";
import assert from "node:assert/strict";
import { generateSecretKey } from "nostr-tools/pure";
import { loadConfig } from "../../src/config.js";
import { publicKeyHex, resolveServerId } from "../../src/identity.js";
import { buildOwnerBundle, ownerChannels } from "../../src/live/discover.js";
import type { RoomRecord } from "../../src/types.js";

function room(type: RoomRecord["type"], id: string): RoomRecord {
  const now = Date.now();
  return { roomId: "room-" + id, discordId: id, zellousId: id, serverId: "server", guildId: "367741339393327104", type, parentId: null, position: 0, name: type + "-" + id, topic: null, discordType: 0, categoryId: null, channelHash: "hash", nsfw: false, bitrate: null, userLimit: null, rateLimitPerUser: null, permissionOverwrites: [], archived: false, locked: false, autoArchiveDuration: null, invitable: null, contentVersion: 1, tombstone: false, createdAt: now, updatedAt: now, deletedAt: null };
}

test("owner bundle has metadata, listed Discover, roles and channels with text and rules page", () => {
  const secret = generateSecretKey();
  const owner = publicKeyHex(secret);
  const config = loadConfig({ DISCORD_TOKEN: "control-token", DISCORD_GUILD_ID: "367741339393327104", ZELLOUS_SERVER_OWNER_HEX: owner });
  const serverId = resolveServerId(config);
  const rooms = [room("text", "1"), room("voice", "2")];
  const channels = ownerChannels(rooms);
  assert.ok(channels.some(function(channel) { return channel.type === "text"; }));
  assert.ok(channels.some(function(channel) { return channel.type === "page"; }));
  const events = buildOwnerBundle(config, serverId, rooms, secret, 100);
  assert.equal(events.length, 4);
  assert.equal(events[0].kind, 34550);
  assert.ok(events[1].tags.some(function(tag: string[]) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-discover:") === 0; }));
  assert.ok(events[2].tags.some(function(tag: string[]) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-roles:") === 0; }));
  assert.ok(events[3].tags.some(function(tag: string[]) { return tag[0] === "d" && String(tag[1]).indexOf("zellous-channels:") === 0; }));
  for (const event of events) assert.equal(event.pubkey, owner);
  assert.ok(events[0].created_at < events[1].created_at && events[1].created_at < events[2].created_at && events[2].created_at < events[3].created_at);
});