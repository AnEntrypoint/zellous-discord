import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile, OWNER_HEX } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { cachedServerName, liveGuildName, sourceEvidencePath } from "../dist/live/source.js";
import { dtag } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest } from "./discord-rest.mjs";

const requiredChannelNames = ["inference", "warez-and-wonders", "Rules"];

async function queryEvents(config, owner, d) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try { return await pool.querySync(config.nostrRelays, { kinds: d.startsWith("discord-") ? [34550] : [30078], authors: [owner], "#d": [d], limit: 20 }, { maxWait: 10000 }); } finally { pool.destroy(); }
}

function sortedNames(values) {
  return [...new Set(values.map(function(value) { return String(value); }))].sort();
}

async function main() {
  const config = loadConfigFromEnvFile();
  const discordRequest = createDiscordRequest(config);
  const owner = ownerHex(config);
  assert.equal(owner, OWNER_HEX, "wrong owner identity");
  const serverId = resolveServerId(config, owner);
  const discordName = await liveGuildName(config);
  const cachedName = cachedServerName(config, serverId);
  const metadata = await queryEvents(config, owner, config.zellousServerDTag);
  const listings = await queryEvents(config, owner, dtag("discover", serverId));
  const snapshots = await queryEvents(config, owner, dtag("channels", serverId));
  const metadataEvent = metadata.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  const listingEvent = listings.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  const snapshotEvent = snapshots.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  assert.ok(metadataEvent, "missing owner-signed metadata");
  assert.ok(listingEvent, "missing owner-signed Discover listing");
  assert.ok(snapshotEvent, "missing owner-signed channel snapshot");
  for (const event of [metadataEvent, listingEvent, snapshotEvent]) assert.equal(event.pubkey, owner, "wrong owner signature");
  const metadataName = String((metadataEvent.tags.find(function(tag) { return tag[0] === "name"; }) || [])[1] ?? "");
  const listingName = String(JSON.parse(listingEvent.content).name ?? "");
  const evidence = JSON.parse(readFileSync(sourceEvidencePath(), "utf8"));
  const browserName = String(evidence.domServerName ?? evidence.serverName ?? "");
  const surfaces = { discordRest: discordName, relayMetadata: metadataName, relayListing: listingName, cachedServers: String(cachedName ?? ""), browserDom: browserName };
  assert.equal(discordName, "247420", "live guild name changed");
  for (const [surface, name] of Object.entries(surfaces)) {
    assert.equal(name, discordName, surface + " does not match live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  const discordChannels = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const discordRest = sortedNames([...discordChannels.map(function(channel) { return String(channel.name); }), "Rules"]);
  const relaySnapshot = sortedNames((JSON.parse(snapshotEvent.content).channels ?? []).map(function(channel) { return String(channel.name); }));
  const cachedChannelMap = sortedNames(evidence.stateChannelNames ?? evidence.domChannelNames ?? []);
  const browserDomVisible = sortedNames(evidence.domVisibleChannelNames ?? []);
  assert.deepEqual(relaySnapshot, discordRest, "relay channel snapshot disagrees with Discord REST");
  assert.deepEqual(cachedChannelMap, discordRest, "cached channel map disagrees with Discord REST");
  assert.equal(discordRest.length, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(browserDomVisible.includes(name), "browser DOM missing channel " + name);
  assert.equal(evidence.staleNamePresent, false, "browser evidence reports a stale name");
  const output = JSON.stringify({ ok: true, owner, serverId, surfaces, channelSurfaces: { discordRest, relaySnapshot, cachedChannelMap, browserDomVisible }, channelCount: discordRest.length, browserPid: evidence.browserPid ?? null, screenshot: evidence.screenshot ?? null, sourceEvidenceAt: evidence.evidenceAt ?? null });
  assert.equal(findSecretPattern(output), null, "secret value in source-of-truth output");
  writeFileSync("data/source-truth.json", output, { mode: 0o600 });
  console.log("SOURCE_OF_TRUTH_PASS name=" + discordName + " surfaces=5 channels=" + String(discordRest.length) + " owner=" + owner);
}

await main();
