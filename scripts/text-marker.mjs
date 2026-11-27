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
import { ATTRIBUTION_PREFIX, parseAttribution, visibleDiscordContent } from "../dist/live/source.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest, sleep } from "./discord-rest.mjs";

const config = loadConfigFromEnvFile();
const discordRequest = createDiscordRequest(config);
const owner = ownerHex(config);
const serverId = resolveServerId(config, owner);
const channelId = "805320534370943016";
const zellousChannelId = "room-" + channelId;
const root = channelHash(serverId, zellousChannelId);
const discordMarker = "zdb-discord-" + randomUUID();
const zellousMarker = "zdb-zellous-" + randomUUID();
const zellousUsername = "zdb-user-" + randomUUID();
const visibleZellousMarker = visibleDiscordContent(zellousUsername, zellousMarker);
const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });

async function relayEvents() {
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
  const discordAttributionTags = discordReflection[0].tags.filter(function(tag) { return tag[0] === "t" && typeof tag[1] === "string" && tag[1].startsWith(ATTRIBUTION_PREFIX); });
  const discordUsername = parseAttribution(discordReflection[0].tags);
  assert.equal(discordAttributionTags.length, 1, "Discord-origin marker attribution missing or duplicated");
  assert.ok(discordUsername && discordUsername.length > 0, "Discord-origin marker username missing");
  const zellous = await publishChatEvent(config, serverId, zellousChannelId, zellousMarker, zellousUsername);
  assert.equal(zellous.ok, true, "Zellous-origin marker publication failed");
  assert.equal(zellous.username, zellousUsername, "Zellous-origin marker username not preserved");
  let zellousReflection = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const events = await relayEvents();
    zellousReflection = events.filter(function(event) { return event.content === zellousMarker; });
    if (zellousReflection.length > 0) break;
    await sleep(1500);
  }
  assert.equal(zellousReflection.length, 1, "Zellous-origin marker missing or duplicated on relays");
  assert.equal(zellousReflection[0].tags.find(function(tag) { return tag[0] === "e"; })?.[1], root, "wrong Zellous channel root");
  assert.equal(parseAttribution(zellousReflection[0].tags), zellousUsername, "Zellous-origin marker attribution mismatch");
  let discordMessages = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    discordMessages = await discordRequest("GET", "/channels/" + channelId + "/messages?limit=20");
    if (discordMessages.filter(function(message) { return message.content.includes(zellousMarker); }).length > 0) break;
    await sleep(1500);
  }
  const zellousInDiscord = discordMessages.filter(function(message) { return message.content.includes(zellousMarker); });
  const bareZellousInDiscord = discordMessages.filter(function(message) { return message.content === zellousMarker; });
  assert.equal(zellousInDiscord.length, 1, "Zellous-origin marker missing or duplicated in Discord");
  assert.equal(bareZellousInDiscord.length, 0, "Zellous-origin marker missing visible attribution");
  assert.equal(zellousInDiscord[0].content, visibleZellousMarker, "Zellous-origin Discord attribution mismatch");
  const after = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const afterCount = after.length;
  assert.equal(beforeCount, afterCount, "channel count changed");
  const health = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health");
  const healthJson = await health.json();
  const expectedPrivileged = config.privilegedIntentsEnabled;
  assert.equal(healthJson.privilegedIntentsEnabled, expectedPrivileged, "health privileged-intent mismatch");
  const expectedDegraded = expectedPrivileged ? [] : ["message-content", "presence", "member-list"];
  for (const feature of expectedDegraded) assert.ok(healthJson.degradedFeatures.includes(feature), "hidden privileged-intent failure");
  const result = { ok: true, serverId, channelId, zellousChannelId, root, discordMarker, zellousMarker, zellousUsername, visibleZellousMarker, discordUsername, discordAttributionTagCount: discordAttributionTags.length, zellousRelayAttribution: parseAttribution(zellousReflection[0].tags), discordReflectionEventId: discordReflection[0].id, zellousEventId: zellous.eventId, discordMessageId: created.id, zellousDiscordMessageId: zellousInDiscord[0].id, bareZellousMarkerCount: bareZellousInDiscord.length, channelCount: afterCount, privilegedIntentsEnabled: expectedPrivileged, degradedFeatures: healthJson.degradedFeatures, liveServicePid, liveServiceCount: processLines.length, duplicateCount: discordReflection.length + zellousReflection.length + zellousInDiscord.length - 3, secretFound: false };
  const output = JSON.stringify(result);
  assert.equal(findSecretPattern(output), null, "secret value in output");
  writeFileSync(join(dir, "text-marker-result.json"), output, { mode: 0o600 });
  await discordRequest("DELETE", "/channels/" + channelId + "/messages/" + created.id).catch(function() {});
  await discordRequest("DELETE", "/channels/" + channelId + "/messages/" + zellousInDiscord[0].id).catch(function() {});
  console.log("TEXT_REFLECTION_PASS discordMarker=" + discordMarker + " zellousMarker=" + zellousMarker + " username=" + zellousUsername + " root=" + root + " channelCount=" + String(afterCount));
}

await main();
