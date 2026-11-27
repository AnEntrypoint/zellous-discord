import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { publishChatEvent } from "../dist/live/chat.js";
import { channelRoot, parseAttribution, rootChannelMap, visibleDiscordContent } from "../dist/live/source.js";
import { Ledger } from "../dist/ledger.js";
import { MappingStore } from "../dist/mapping.js";
import { channelHash } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest, sleep } from "./discord-rest.mjs";

const config = loadConfigFromEnvFile();
const discordRequest = createDiscordRequest(config);
const serverId = resolveServerId(config, ownerHex(config));
const channelNames = ["inference", "warez-and-wonders"];
const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });

function sourceMtimes(path, result) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) sourceMtimes(child, result);
    else if (entry.name.endsWith(".ts")) result.push(statSync(child).mtimeMs);
  }
  return result;
}

function distFresh() {
  const built = statSync("dist/cli.js").mtimeMs;
  return built >= Math.max(...sourceMtimes("src", []));
}

function serviceLines() {
  return execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(String.fromCharCode(10)).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; });
}

async function relayEvents(roots) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try {
    return await pool.querySync(config.nostrRelays, { kinds: [42], "#e": roots, since: Math.floor(Date.now() / 1000) - 180, limit: 100 }, { maxWait: 10000 });
  } finally { pool.destroy(); }
}

function rootTag(event) {
  const tags = (event.tags ?? []);
  return (tags.find(function(tag) { return tag[0] === "e" && (tag[3] === "root" || !tag[3]); }) ?? tags.find(function(tag) { return tag[0] === "e"; }))?.[1] ?? "";
}

async function main() {
  const lines = serviceLines();
  assert.equal(lines.length, 1, "more than one live service");
  const liveServicePid = String(lines[0].trim().split(/\s+/)[0]);
  const before = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const channels = channelNames.map(function(name) {
    const matches = before.filter(function(channel) { return channel.type === 0 && channel.name === name; });
    assert.equal(matches.length, 1, "Discord channel missing or duplicated: " + name);
    return { name, id: String(matches[0].id) };
  });
  assert.notEqual(channels[0].id, channels[1].id, "witness channels are not distinct");
  const leftover = [];
  for (const channel of channels) {
    const prior = await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50");
    for (const message of prior) if (String(message.content).includes("zdb-channel-") && String(message.content).includes("[zdb-user-")) await discordRequest("DELETE", "/channels/" + channel.id + "/messages/" + message.id).catch(function() {});
    const remaining = await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50");
    for (const message of remaining) if (String(message.content).includes("zdb-channel-") && String(message.content).includes("[zdb-user-")) leftover.push({ channelId: channel.id, messageId: String(message.id) });
  }
  assert.equal(leftover.length, 0, "witness marker left behind");
  const ledger = new Ledger(join(config.bridgeStateDir, "bridge-ledger.jsonl"));
  const liveRoots = rootChannelMap(serverId, new MappingStore(ledger));
  const markers = channels.map(function(channel) {
    const root = channelRoot(serverId, channel.id);
    assert.equal(root, channelHash(serverId, "room-" + channel.id), "kind 42 root is not the canonical channel hash");
    assert.equal(liveRoots.get(root), channel.id, "kind 42 root is missing from the live ledger");
    return { ...channel, root, zellousChannelId: "room-" + channel.id, marker: "zdb-channel-" + randomUUID(), username: "zdb-user-" + randomUUID() };
  });
  const unknownId = "9".repeat(18);
  const unknown = { root: channelHash(serverId, "room-" + unknownId), zellousChannelId: "room-" + unknownId, marker: "zdb-unknown-" + randomUUID(), username: "zdb-user-" + randomUUID() };
  assert.equal(liveRoots.get(unknown.root), undefined, "unknown root is mapped to a Discord channel");
  const publications = [];
  for (const item of [...markers, unknown]) publications.push(await publishChatEvent(config, serverId, item.zellousChannelId, item.marker, item.username));
  for (const publication of publications) assert.equal(publication.ok, true, "kind 42 publication failed");
  const roots = [...markers.map(function(item) { return item.root; }), unknown.root];
  let events = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    events = await relayEvents(roots);
    if (markers.every(function(item) { return events.filter(function(event) { return event.content === item.marker; }).length === 1; })) break;
    await sleep(1500);
  }
  for (const item of markers) {
    const found = events.filter(function(event) { return event.content === item.marker; });
    assert.equal(found.length, 1, "kind 42 marker missing or duplicated: " + item.name);
    assert.equal(rootTag(found[0]), item.root, "wrong kind 42 e root: " + item.name);
    assert.equal(parseAttribution(found[0].tags), item.username, "kind 42 attribution mismatch: " + item.name);
  }
  assert.equal(events.filter(function(event) { return event.content === unknown.marker; }).length, 1, "unknown-root kind 42 marker not published");
  const messagesByChannel = new Map();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const channel of channels) messagesByChannel.set(channel.id, await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50"));
    if (markers.every(function(item) { return messagesByChannel.get(item.id).some(function(message) { return message.content.includes(item.marker); }); })) break;
    await sleep(1500);
  }
  await sleep(1500);
  const finalMessages = new Map();
  for (const channel of channels) finalMessages.set(channel.id, await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50"));
  const reflected = markers.map(function(item) {
    const own = finalMessages.get(item.id).filter(function(message) { return message.content.includes(item.marker); });
    const other = channels.filter(function(channel) { return channel.id !== item.id; });
    const wrong = other.reduce(function(total, channel) { return total + finalMessages.get(channel.id).filter(function(message) { return message.content.includes(item.marker); }).length; }, 0);
    assert.equal(own.length, 1, "marker missing or duplicated in its Discord channel: " + item.name);
    assert.equal(wrong, 0, "marker reflected to the wrong Discord channel: " + item.name);
    assert.equal(own[0].content, visibleDiscordContent(item.username, item.marker), "visible attribution mismatch: " + item.name);
    return { name: item.name, channelId: item.id, root: item.root, marker: item.marker, username: item.username, discordMessageId: String(own[0].id), ownCount: own.length, wrongChannelCount: wrong };
  });
  const unknownPosts = [...finalMessages.values()].reduce(function(total, messages) { return total + messages.filter(function(message) { return message.content.includes(unknown.marker); }).length; }, 0);
  assert.equal(unknownPosts, 0, "unknown root posted to Discord");
  const after = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  assert.equal(before.length, after.length, "channel count changed");
  const response = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health");
  const health = await response.json();
  if (health.voiceReflectionComplete) assert.ok(health.voiceTokenCount >= 2 && health.voiceFrameCount > 0, "degraded voice reflection falsely marked complete");
  const fresh = distFresh();
  assert.equal(fresh, true, "stale dist");
  const result = { ok: true, serverId, rootSource: "kind42-e-root", channelSource: "discord-rest", channels: reflected, unknownRoot: { root: unknown.root, marker: unknown.marker, relayCount: events.filter(function(event) { return event.content === unknown.marker; }).length, discordPostCount: unknownPosts }, leftoverMarkerCount: leftover.length, channelCount: after.length, liveServiceCount: lines.length, liveServicePid, voiceReflectionComplete: health.voiceReflectionComplete, voiceTokenCount: health.voiceTokenCount, voiceFrameCount: health.voiceFrameCount, distFresh: fresh, secretFound: false };
  const output = JSON.stringify(result);
  assert.equal(findSecretPattern(output), null, "secret value in output");
  writeFileSync(join(dir, "channel-marker-result.json"), output, { mode: 0o600 });
  for (const item of reflected) await discordRequest("DELETE", "/channels/" + item.channelId + "/messages/" + item.discordMessageId).catch(function() {});
  console.log("CHANNEL_REFLECTION_PASS inference=" + String(reflected[0].channelId) + " warez=" + String(reflected[1].channelId) + " roots=" + String(reflected.length) + " wrongChannel=0 unknownRootPosts=0 channelCount=" + String(after.length));
}

await main();
