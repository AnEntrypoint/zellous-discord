import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, requireOwnerKey, resolveServerId } from "../dist/identity.js";
import { buildOwnerBundle } from "../dist/live/discover.js";
import { liveGuildIconUrl, liveGuildName } from "../dist/live/source.js";

const backoffMs = 30 * 60 * 1000;

export function healAllowed(state, lastPublishMs, tree, nowMs) {
  if (state && state.tree === tree) return { ok: false, reason: "already attempted on tree " + tree };
  const last = Math.max(Number(state?.at ?? 0), Number(lastPublishMs ?? 0));
  if (nowMs - last < backoffMs) return { ok: false, reason: "backoff until " + new Date(last + backoffMs).toISOString() };
  return { ok: true, reason: null };
}

function selfTest() {
  const now = Date.parse("2026-11-28T19:00:00Z");
  assert.equal(healAllowed(null, now - 10 * 60000, "abc", now).ok, false, "publish inside backoff did not fail");
  assert.equal(healAllowed(null, now - 31 * 60000, "abc", now).ok, true, "publish after backoff was refused");
  assert.equal(healAllowed({ at: now - 60 * 60000, tree: "abc" }, now - 90 * 60000, "abc", now).ok, false, "repeat on the same tree did not fail");
  assert.equal(healAllowed({ at: now - 10 * 60000, tree: "old" }, now - 90 * 60000, "abc", now).ok, false, "recent heal attempt did not fail");
  assert.equal(healAllowed({ at: now - 60 * 60000, tree: "old" }, now - 90 * 60000, "abc", now).ok, true, "new tree after backoff was refused");
  console.log("RELAY_HEAL_SELF_TEST_PASS cases=5");
}

async function newest(pool, relay, owner, dTag) {
  const timeout = new Promise(function(resolve) { setTimeout(function() { resolve([]); }, 8000); });
  const events = await Promise.race([pool.querySync([relay], { kinds: [34550], authors: [owner], "#d": [dTag], limit: 5 }, { maxWait: 6000 }).catch(function() { return []; }), timeout]);
  return events.sort(function(a, b) { return b.created_at - a.created_at; })[0] ?? null;
}

async function main() {
  const config = loadConfigFromEnvFile();
  const owner = ownerHex(config);
  const serverId = resolveServerId(config, owner);
  const tree = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
  const statePath = join(config.bridgeStateDir, "relay-heal.json");
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null;
  const eventsPath = join(config.bridgeStateDir, "discover-events.json");
  const lastPublishMs = existsSync(eventsPath) ? statSync(eventsPath).mtimeMs : 0;
  const allowed = healAllowed(state, lastPublishMs, tree, Date.now());
  if (!allowed.ok) { console.log("RELAY_HEAL_SKIPPED " + allowed.reason); return; }
  const name = await liveGuildName(config);
  const icon = await liveGuildIconUrl(config);
  const event = buildOwnerBundle(config, serverId, [], requireOwnerKey(config), Math.floor(Date.now() / 1000), name, icon)[0];
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: false });
  const results = {};
  try {
    for (const relay of config.nostrRelays) {
      const current = await newest(pool, relay, owner, config.zellousServerDTag);
      const currentName = String((current?.tags.find(function(tag) { return tag[0] === "name"; }) || [])[1] ?? "");
      const currentIcon = String((current?.tags.find(function(tag) { return tag[0] === "icon"; }) || [])[1] ?? "");
      if (current && currentName === name && currentIcon === icon) { results[relay] = "current"; continue; }
      const timeout = new Promise(function(resolve) { setTimeout(function() { resolve("timeout"); }, 15000); });
      const outcome = await Promise.race([Promise.allSettled(pool.publish([relay], event)).then(function(settled) { return settled[0].status === "fulfilled" ? "accepted" : "rejected: " + String(settled[0].reason?.message ?? settled[0].reason); }), timeout]);
      results[relay] = outcome;
    }
  } finally { pool.destroy(); }
  writeFileSync(statePath, JSON.stringify({ at: Date.now(), atIso: new Date().toISOString(), tree, results }), { mode: 0o600 });
  console.log("RELAY_HEAL_DONE tree=" + tree + " " + JSON.stringify(results));
}

if (process.argv.includes("--self-test")) selfTest();
else if (process.argv[1] && process.argv[1].endsWith("relay-heal.mjs")) await main();
