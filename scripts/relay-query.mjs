import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile, OWNER_HEX } from "../dist/config.js";

async function main() {
  const config = loadConfigFromEnvFile();
  if (!existsSync("data/discover-events.json")) throw new Error("owner bundle not published: BRIDGE_PRIVATE_KEY_HEX is missing from .env");
  const ids = JSON.parse(readFileSync("data/discover-events.json", "utf8"));
  assert.equal(ids.length, 4, "expected four owner bundle event ids");
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const found = [];
  for (const id of ids) {
    const event = await pool.get(config.nostrRelays, { ids: [id] }, { maxWait: 8000 });
    assert.ok(event, "missing relay event " + id);
    assert.equal(event.pubkey, OWNER_HEX, "wrong pubkey for " + id);
    found.push(event);
  }
  pool.destroy();
  const created = found.map(function(event) { return event.created_at; });
  assert.deepEqual(created, [...created].sort(function(a, b) { return a - b; }), "event timestamps are not increasing");
  console.log("RELAY_QUERY_PASS kinds=" + found.map(function(event) { return String(event.kind); }).join(",") + " owner=" + OWNER_HEX);
}

await main();