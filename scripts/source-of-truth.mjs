import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile, OWNER_HEX } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { liveGuildName, cachedServerName, sourceEvidencePath } from "../dist/live/source.js";
import { dtag } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";

async function queryEvents(config, owner, d) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try { return await pool.querySync(config.nostrRelays, { kinds: d.startsWith("discord-") ? [34550] : [30078], authors: [owner], "#d": [d], limit: 20 }, { maxWait: 10000 }); } finally { pool.destroy(); }
}

async function main() {
  const config = loadConfigFromEnvFile();
  const owner = ownerHex(config);
  const serverId = resolveServerId(config, owner);
  const discordName = await liveGuildName(config);
  const cachedName = cachedServerName(config, serverId);
  const metadata = await queryEvents(config, owner, config.zellousServerDTag);
  const listings = await queryEvents(config, owner, dtag("discover", serverId));
  const metadataEvent = metadata.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  const listingEvent = listings.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  assert.ok(metadataEvent, "missing owner-signed metadata");
  assert.ok(listingEvent, "missing owner-signed Discover listing");
  assert.equal(metadataEvent.pubkey, owner, "wrong metadata author");
  assert.equal(listingEvent.pubkey, owner, "wrong listing author");
  const metadataName = String((metadataEvent.tags.find(function(tag) { return tag[0] === "name"; }) || [])[1] ?? "");
  const listingName = String(JSON.parse(listingEvent.content).name ?? "");
  const evidence = JSON.parse(readFileSync(sourceEvidencePath(), "utf8"));
  const browserName = String(evidence.domServerName ?? evidence.serverName ?? "");
  const surfaces = { discordRest: discordName, relayMetadata: metadataName, relayListing: listingName, cachedServers: cachedName, browserDom: browserName };
  for (const [surface, name] of Object.entries(surfaces)) {
    assert.equal(name, "247420", surface + " does not match live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  const output = JSON.stringify({ ok: true, owner, serverId, surfaces, browserPid: evidence.browserPid ?? null, screenshot: evidence.screenshot ?? null });
  assert.equal(findSecretPattern(output), null, "secret value in source-of-truth output");
  writeFileSync("data/source-truth.json", output, { mode: 0o600 });
  console.log("SOURCE_OF_TRUTH_PASS name=247420 discord=" + discordName + " metadata=" + metadataName + " listing=" + listingName + " cache=" + String(cachedName) + " dom=" + browserName + " owner=" + owner);
}

await main();
