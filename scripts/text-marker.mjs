import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { channelHash } from "../dist/nostr.js";
import { publishChatEvent } from "../dist/live/chat.js";
import { findSecretPattern } from "../dist/redaction.js";

const config = loadConfigFromEnvFile();
const owner = ownerHex(config);
const serverId = resolveServerId(config, owner);
const channelId = "805320534370943016";
const zellousChannelId = "room-" + channelId;
const root = channelHash(serverId, zellousChannelId);
const discordMarker = "zdb-discord-" + randomUUID();
const zellousMarker = "zdb-zellous-" + randomUUID();
const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });

async function discordRequest(method, path, body) {
  const response = await fetch("https://discord.com/api/v10" + path, { method, headers: { Authorization: "Bot " + config.discordToken.reveal(), "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Discord REST failed with status " + String(response.status));
  return response.status === 204 ? null : await response.json();
}

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

async function relayEvents(content) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try { return await pool.querySync(config.nostrRelays, { kinds: [42], "#e": [root], since: Math.floor(Date.now() / 1000) - 120, limit: 50 }, { maxWait: 10000 }); } finally { pool.destroy(); }
}

async function main() {
  const processLines = execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(String.fromCharCode(10)).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; });
  assert.equal(processLines.length, 1, "more than one live service");
  const liveServicePid = String(processLines[0].trim().split(/\s+/)[0]);
  const before = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const beforeCount = before.length;
  const created = await discordRequest("POST", "/channels/" + channelId + "/messages", { content: discordMarker, allowed_mentions: { parse: [] } });
  let discordReflection = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const events = await relayEvents();
    discordReflection = events.filter(function(event) { return event.content === discordMarker; });
    if (discordReflection.length > 0) break;
    await sleep(1500);
  }
  assert.equal(discordReflection.length, 1, "Discord-origin marker missing or duplicated on relays");
  assert.equal(discordReflection[0].tags.find(function(tag) { return tag[0] === "e"; })?.[1], root, "wrong channel root");
  const zellous = await publishChatEvent(config, serverId, zellousChannelId, zellousMarker);
  assert.equal(zellous.ok, true, "Zellous-origin marker publication failed");
  let discordMessages = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    discordMessages = await discordRequest("GET", "/channels/" + channelId + "/messages?limit=20");
    if (discordMessages.filter(function(message) { return message.content === zellousMarker; }).length > 0) break;
    await sleep(1500);
  }
  const zellousInDiscord = discordMessages.filter(function(message) { return message.content === zellousMarker; });
  assert.equal(zellousInDiscord.length, 1, "Zellous-origin marker missing or duplicated in Discord");
  const after = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const afterCount = after.length;
  assert.equal(beforeCount, afterCount, "channel count changed");
  const health = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health");
  const healthJson = await health.json();
  assert.equal(healthJson.privilegedIntentsEnabled, false, "privileged intents unexpectedly enabled");
  assert.ok(healthJson.degradedFeatures.includes("message-content"), "hidden privileged-intent failure");
  const result = { ok: true, serverId, channelId, zellousChannelId, root, discordMarker, zellousMarker, discordReflectionEventId: discordReflection[0].id, zellousEventId: zellous.eventId, discordMessageId: created.id, channelCount: afterCount, privilegedIntentsEnabled: false, liveServicePid, liveServiceCount: processLines.length, duplicateCount: discordReflection.length + zellousInDiscord.length - 2, secretFound: false };
  const output = JSON.stringify(result);
  assert.equal(findSecretPattern(output), null, "secret value in output");
  writeFileSync(join(dir, "text-marker-result.json"), output, { mode: 0o600 });
  await discordRequest("DELETE", "/channels/" + channelId + "/messages/" + created.id).catch(function() {});
  await discordRequest("DELETE", "/channels/" + channelId + "/messages/" + zellousInDiscord[0].id).catch(function() {});
  console.log("TEXT_REFLECTION_PASS discordMarker=" + discordMarker + " zellousMarker=" + zellousMarker + " root=" + root + " channelCount=" + String(afterCount));
}

await main();
