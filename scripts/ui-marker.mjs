import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { channelRoot, liveClientAuthor, resolveZellousMessage, rootChannelMap, visibleDiscordContent } from "../dist/live/source.js";
import { Ledger } from "../dist/ledger.js";
import { MappingStore } from "../dist/mapping.js";
import { channelHash } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest, sleep } from "./discord-rest.mjs";
import { playwriter } from "./playwriter.mjs";

const nl = String.fromCharCode(10);
const config = loadConfigFromEnvFile();
const discordRequest = createDiscordRequest(config);
const serverId = resolveServerId(config, ownerHex(config));
const names = ["inference", "warez-and-wonders"];
const markers = { inference: "zdb-ui-inference-" + randomUUID(), "warez-and-wonders": "zdb-ui-warez-" + randomUUID() };
const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });
const screenshotPath = join(dir, "ui-discover.png");

function sourceMtimes(path, result) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) sourceMtimes(child, result);
    else if (entry.name.endsWith(".ts")) result.push(statSync(child).mtimeMs);
  }
  return result;
}

function distFresh() {
  return statSync("dist/cli.js").mtimeMs >= Math.max(...sourceMtimes("src", []));
}

function serviceLines() {
  return execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(nl).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; });
}

async function relayEvents(roots) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  try {
    const timeout = new Promise(function(resolve) { setTimeout(function() { resolve([]); }, 10000); });
    return await Promise.race([pool.querySync(config.nostrRelays, { kinds: [42], "#e": roots, since: Math.floor(Date.now() / 1000) - 180, limit: 100 }, { maxWait: 10000 }), timeout]);
  } finally { pool.destroy(); }
}

function channelClick(name) {
  return "eval=(function(){var n=" + JSON.stringify(name) + ";var a=Array.from(document.querySelectorAll('a[title]')).find(function(x){return x.getAttribute('title')===n});if(!a)return 'missing channel';a.click();return 'clicked'})()";
}

function focusInput() {
  return "eval=(function(){var t=Array.from(document.querySelectorAll('textarea')).find(function(x){return /Message #/.test(x.getAttribute('placeholder')||'')});if(!t)return 'missing input';t.focus();return 'focused'})()";
}

function capture(key, marker) {
  const js = "(function(){var m=" + JSON.stringify(marker) + ";var t=Array.from(document.querySelectorAll('textarea')).find(function(x){return /Message #/.test(x.getAttribute('placeholder')||'')});var q=(window.__zellous.chat.messages||[]).filter(function(x){return x.content===m})[0]||null;window.__zdbWitness=window.__zdbWitness||{};window.__zdbWitness." + key + "={active:window.__zellous.state.currentChannelId,chatActive:window.__zellous.chat.activeChannelId,placeholder:t?t.getAttribute('placeholder'):null,domVisible:document.body.innerText.includes(m),message:q?{id:q.id,pubkey:q.userId}:null};localStorage.setItem('zdbWitness',JSON.stringify(window.__zdbWitness));return 'captured'})()";
  return "eval=" + js;
}

function finalEvidence(guildName) {
  const js = "(function(){var n=" + JSON.stringify(guildName) + ";var a=JSON.parse(localStorage.getItem('zn_servers')||'[]');var s=a.find(function(x){return x.id===localStorage.getItem('zn_lastServer')});var body=String(document.body.innerText||'');var cls=String(document.documentElement.className||'');var elements=Array.from(document.querySelectorAll('h1,h2,h3,[aria-label],[title],[data-server-name]'));var element=elements.map(function(x){return String(x.textContent||x.getAttribute('aria-label')||x.getAttribute('title')||x.getAttribute('data-server-name')||'').trim();}).find(function(x){return x===n;});var dom=element?n:(body.includes(n)?n:(cls.includes('ds-'+n)?n:null));var source=element?'dom-element':(body.includes(n)?'dom-body-text':(cls.includes('ds-'+n)?'dom-document-class':null));window.__zdbWitness=window.__zdbWitness||{};window.__zdbWitness.serverName=s?s.name:null;window.__zdbWitness.domServerName=dom;window.__zdbWitness.domServerNameSource=source;window.__zdbWitness.domStaleNamePresent=body.includes('Discord Bridge');window.__zdbWitness.url=location.href;localStorage.setItem('zdbWitness',JSON.stringify(window.__zdbWitness));return JSON.stringify(window.__zdbWitness)})()";
  return "eval=" + js;
}

function browserSteps(guildName) {
  const join = "eval=(async function(){var sid=" + JSON.stringify(serverId) + ";await window.__zellous.servers.join(sid);await window.__zellous.servers.switchTo(sid);return 'ready'})()";
  const cacheName = "eval=(function(){var sid=" + JSON.stringify(serverId) + ";var n=" + JSON.stringify(guildName) + ";var a=JSON.parse(localStorage.getItem('zn_servers')||'[]');var s=a.find(function(x){return x.id===sid});if(!s){a.push({id:sid,name:n})}else{s.name=n}localStorage.setItem('zn_servers',JSON.stringify(a));return 'cached'})()";
  const first = [
    join,
    "wait=1500",
    cacheName,
    channelClick("inference"),
    "wait=2500",
    focusInput(),
    "type=" + markers.inference,
    "press=Enter",
    "wait=3500",
    capture("inference", markers.inference),
    "screenshot=" + screenshotPath
  ].join(nl);
  const second = [
    channelClick("warez-and-wonders"),
    "wait=2500",
    focusInput(),
    "type=" + markers["warez-and-wonders"],
    "press=Enter",
    "wait=3500",
    capture("warez", markers["warez-and-wonders"]),
    finalEvidence(guildName)
  ].join(nl);
  return { first, second };
}

function rootTag(event) {
  const tags = event.tags ?? [];
  return (tags.find(function(tag) { return tag[0] === "e" && (tag[3] === "root" || !tag[3]); }) ?? tags.find(function(tag) { return tag[0] === "e"; }))?.[1] ?? "";
}

async function main() {
  const lines = serviceLines();
  assert.equal(lines.length, 1, "more than one live service");
  const liveServicePid = String(lines[0].trim().split(/\s+/)[0]);
  const guild = await discordRequest("GET", "/guilds/" + config.discordGuildId);
  const guildName = String(guild.name ?? "");
  assert.ok(guildName, "live guild name missing");
  const before = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const channels = names.map(function(name) {
    const matches = before.filter(function(channel) { return channel.type === 0 && channel.name === name; });
    assert.equal(matches.length, 1, "Discord channel missing or duplicated: " + name);
    return { name, id: String(matches[0].id) };
  });
  assert.notEqual(channels[0].id, channels[1].id, "witness channels are not distinct");
  const leftover = [];
  for (const channel of channels) {
    const prior = await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50");
    for (const message of prior) if (String(message.content).includes("zdb-ui-")) await discordRequest("DELETE", "/channels/" + channel.id + "/messages/" + message.id).catch(function() {});
    const remaining = await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50");
    for (const message of remaining) if (String(message.content).includes("zdb-ui-")) leftover.push({ channelId: channel.id, messageId: String(message.id) });
  }
  assert.equal(leftover.length, 0, "witness marker left behind");
  const ledger = new Ledger(join(config.bridgeStateDir, "bridge-ledger.jsonl"));
  const liveRoots = rootChannelMap(serverId, new MappingStore(ledger));
  const targets = channels.map(function(channel) {
    const root = channelRoot(serverId, channel.id);
    assert.equal(root, channelHash(serverId, "room-" + channel.id), "kind 42 root is not the canonical channel hash");
    assert.equal(liveRoots.get(root), channel.id, "kind 42 root is missing from the live ledger");
    return { ...channel, root };
  });
  const unknownRoot = channelHash(serverId, "room-" + "9".repeat(18));
  assert.equal(liveRoots.get(unknownRoot), undefined, "unknown root is mapped to a Discord channel");
  assert.equal(resolveZellousMessage([["e", unknownRoot, "", "root"]], liveRoots, "5db360ba057d70b60bc3514011c3998e77e8d7ddceaab6ce5a77b5b45371097e"), null, "unknown root is not suppressed");
  const steps = browserSteps(guildName);
  const browser = await playwriter(steps.first, steps.second);
  const evidence = JSON.parse(browser.evalValues.at(-1));
  assert.equal(evidence.serverName, guildName, "browser cached server name is stale");
  assert.equal(evidence.domServerName, guildName, "browser DOM server name is stale");
  assert.ok(["dom-element", "dom-body-text", "dom-document-class"].includes(evidence.domServerNameSource), "browser DOM server name source is cached-only");
  assert.equal(evidence.domStaleNamePresent, false, "browser DOM shows stale Discord Bridge name");
  assert.ok(String(evidence.url).includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.ok(existsSync(screenshotPath), "browser screenshot missing");
  assert.ok(browser.firstSteps.includes("type") && browser.firstSteps.includes("press") && browser.firstSteps.includes("screenshot"), "live UI inference typing steps missing");
  assert.ok(browser.secondSteps.includes("type") && browser.secondSteps.includes("press") && browser.secondSteps.includes("eval"), "live UI warez typing steps missing");
  assert.ok(browser.steps.includes("type") && browser.steps.includes("press") && browser.steps.includes("screenshot"), "live UI browser steps missing");
  const ui = {};
  const uiStates = {};
  for (const target of targets) {
    const key = target.name === "inference" ? "inference" : "warez";
    const state = evidence[key];
    assert.ok(state, "missing live Zellous UI evidence for " + target.name);
    assert.equal(state.active, "room-" + target.id, "active-UI channel fallback: " + target.name);
    assert.equal(state.chatActive, "room-" + target.id, "wireweave active channel mismatch: " + target.name);
    assert.equal(state.placeholder, "Message #" + target.name, "message input is not bound to " + target.name);
    assert.equal(state.domVisible, true, "marker not visible in the live Zellous UI: " + target.name);
    assert.ok(state.message, "missing live UI message: " + target.name);
    assert.equal(String(state.message.id).length, 64, "live UI event ID missing");
    assert.ok(/^[0-9a-f]{64}$/.test(String(state.message.pubkey)), "live UI pubkey missing");
    ui[target.name] = state.message;
    uiStates[target.name] = state;
  }
  const roots = targets.map(function(target) { return target.root; });
  let events = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    events = await relayEvents(roots);
    if (targets.every(function(target) { return events.filter(function(event) { return event.content === markers[target.name]; }).length === 1; })) break;
    await sleep(1500);
  }
  const relay = {};
  for (const target of targets) {
    const marker = markers[target.name];
    const found = events.filter(function(event) { return event.content === marker; });
    assert.equal(found.length, 1, "live UI marker missing or duplicated on relays: " + target.name);
    assert.equal(found[0].id, ui[target.name].id, "relay event is not the live UI event: " + target.name);
    assert.equal(found[0].pubkey, ui[target.name].pubkey, "relay event author is not the live UI identity");
    assert.equal(rootTag(found[0]), target.root, "wrong kind 42 e root: " + target.name);
    const syntheticTags = (found[0].tags ?? []).filter(function(tag) { return tag[0] === "t" && (String(tag[1]).startsWith("zdb-user:") || tag[1] === "zdb-bridge"); });
    assert.equal(syntheticTags.length, 0, "relay event carries synthetic witness tags: " + target.name);
    relay[target.name] = { eventId: String(found[0].id), pubkey: String(found[0].pubkey), root: rootTag(found[0]), syntheticTagCount: syntheticTags.length };
  }
  const finalMessages = new Map();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    for (const channel of channels) finalMessages.set(channel.id, await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50"));
    if (targets.every(function(target) { return finalMessages.get(target.id).some(function(message) { return String(message.content).includes(markers[target.name]); }); })) break;
    await sleep(1500);
  }
  await sleep(1500);
  const settled = new Map();
  for (const channel of channels) settled.set(channel.id, await discordRequest("GET", "/channels/" + channel.id + "/messages?limit=50"));
  const reflected = targets.map(function(target) {
    const marker = markers[target.name];
    const own = settled.get(target.id).filter(function(message) { return String(message.content).includes(marker); });
    const wrong = targets.filter(function(other) { return other.id !== target.id; }).reduce(function(total, other) { return total + settled.get(other.id).filter(function(message) { return String(message.content).includes(marker); }).length; }, 0);
    assert.equal(own.length, 1, "marker missing or duplicated in its Discord channel: " + target.name);
    assert.equal(wrong, 0, "marker reflected to the wrong Discord channel: " + target.name);
    const username = liveClientAuthor(ui[target.name].pubkey);
    assert.equal(own[0].content, visibleDiscordContent(username, marker), "visible attribution mismatch: " + target.name);
    const state = uiStates[target.name];
    const stepList = target.name === "inference" ? browser.firstSteps : browser.secondSteps;
    return { name: target.name, channelId: target.id, root: target.root, marker, uiEventId: ui[target.name].id, uiPubkey: ui[target.name].pubkey, username, discordMessageId: String(own[0].id), discordContent: String(own[0].content), ownCount: own.length, wrongChannelCount: wrong, relayCount: 1, relayRoot: relay[target.name].root, syntheticTagCount: relay[target.name].syntheticTagCount, activeChannelId: state.active, placeholder: state.placeholder, domVisible: state.domVisible, typedInDom: state.domVisible, pressedEnter: stepList.includes("press") };
  });
  const unknownPosts = [...settled.values()].reduce(function(total, messages) { return total + messages.filter(function(message) { return String(message.content).includes("zdb-ui-unknown-"); }).length; }, 0);
  assert.equal(unknownPosts, 0, "unknown root posted to Discord");
  const after = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  assert.equal(before.length, after.length, "channel count changed");
  const response = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health");
  const health = await response.json();
  if (health.voiceReflectionComplete) assert.ok(health.voiceTokenCount >= 2 && health.voiceFrameCount > 0, "degraded voice reflection falsely marked complete");
  const fresh = distFresh();
  assert.equal(fresh, true, "stale dist");
  const result = { ok: true, serverId, sendPath: "live-zellous-ui", syntheticOnly: false, publishChatEventUsed: false, browser: { url: String(evidence.url), domServerName: String(evidence.domServerName), domServerNameSource: String(evidence.domServerNameSource), cachedServerName: String(evidence.serverName), cachedOnly: false, serverNameSource: "playwriter-browser-dom", screenshot: screenshotPath, firstSteps: browser.firstSteps, secondSteps: browser.secondSteps, steps: browser.steps, firstBody: steps.first, secondBody: steps.second }, channels: reflected, unknownRoot: { root: unknownRoot, suppressed: true, discordPostCount: unknownPosts }, activeUiFallback: false, leftoverMarkerCount: leftover.length, channelCount: after.length, liveServiceCount: lines.length, liveServicePid, voiceReflectionComplete: health.voiceReflectionComplete, voiceTokenCount: health.voiceTokenCount, voiceFrameCount: health.voiceFrameCount, distFresh: fresh, secretFound: false };
  const output = JSON.stringify(result);
  assert.equal(findSecretPattern(output), null, "secret value in output");
  writeFileSync(join(dir, "ui-marker-result.json"), output, { mode: 0o600 });
  for (const item of reflected) await discordRequest("DELETE", "/channels/" + item.channelId + "/messages/" + item.discordMessageId).catch(function() {});
  console.log("UI_REFLECTION_PASS inference=" + String(reflected[0].channelId) + " warez=" + String(reflected[1].channelId) + " sendPath=live-zellous-ui roots=" + String(reflected.length) + " wrongChannel=0 unknownRootPosts=0 duplicates=0 channelCount=" + String(after.length));
}

await main();
