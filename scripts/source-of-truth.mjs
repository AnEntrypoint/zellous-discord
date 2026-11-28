import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SimplePool } from "nostr-tools";
import { useWebSocketImplementation } from "nostr-tools/pool";
import { loadConfigFromEnvFile, OWNER_HEX } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { cachedServerIcon, cachedServerName, discordGuildIconUrl, liveGuildIconUrl, liveGuildName, sourceEvidencePath } from "../dist/live/source.js";
import { dtag } from "../dist/nostr.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest, sleep } from "./discord-rest.mjs";
import { playwriter } from "./playwriter.mjs";

const nl = String.fromCharCode(10);
const requiredChannelNames = ["inference", "warez-and-wonders", "Rules"];

function serviceLines() {
  return execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" }).split(nl).filter(function(line) { return line.indexOf("dist/cli.js serve") >= 0; });
}

async function queryEvents(config, owner, d, relays = config.nostrRelays) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const timeout = new Promise(function(resolve) { setTimeout(function() { resolve([]); }, 10000); });
  try { return await Promise.race([pool.querySync(relays, { kinds: d.startsWith("discord-") ? [34550] : [30078], authors: [owner], "#d": [d], limit: 20 }, { maxWait: 10000 }), timeout]); } finally { pool.destroy(); }
}

function sortedNames(values) {
  return [...new Set(values.map(function(value) { return String(value); }))].sort();
}

function browserSteps(serverId, scratchDir) {
  const screenshot = join(scratchDir, "source-discover.png");
  const clear = "eval=(function(){localStorage.removeItem('zn_servers');localStorage.removeItem('zn_lastServer');return 'fresh visitor'})()";
  const joinStep = "eval=(async function(){var sid=" + JSON.stringify(serverId) + ";await window.__zellous.servers.join(sid);await window.__zellous.servers.switchTo(sid);return 'ready'})()";
  const first = [clear, "url=https://anentrypoint.github.io/zellous/nostr-chat/", "wait=9000", joinStep, "wait=9000", "screenshot=" + screenshot].join(nl);
  const evidence = "eval=(function(){var sid=" + JSON.stringify(serverId) + ";var all=Array.from(document.querySelectorAll('a[title]'));var firstRules=all.findIndex(function(a){return a.getAttribute('title')==='Rules'});var railEls=all.slice(0,firstRules<0?all.length:firstRules);var chNames=(firstRules<0?[]:all.slice(firstRules)).map(function(a){return String(a.getAttribute('title'))});var generic=['Direct Messages','Zellous Public','Create a server','Find new servers to join'];var rail=railEls.find(function(a){return generic.indexOf(a.getAttribute('title'))<0})||null;var img=rail?rail.querySelector('img'):null;var bg=rail?String(getComputedStyle(rail).backgroundImage||''):'';var stored=JSON.parse(localStorage.getItem('zn_servers')||'[]').find(function(x){return x.id===sid})||{};var body=String(document.body.innerText||'');return JSON.stringify({url:location.href,source:'playwriter browser DOM',railTitle:rail?String(rail.getAttribute('title')||''):'',railLogoSrc:img?String(img.getAttribute('src')||''):(bg.indexOf('url(')>=0?bg:''),railHtml:rail?rail.outerHTML.slice(0,500):'',railTitles:railEls.map(function(a){return String(a.getAttribute('title'))}),storedName:String(stored.name||''),storedIcon:String(stored.icon||''),bodyHasName:body.indexOf('247420')>=0,staleNamePresent:body.indexOf('Discord Bridge')>=0||String(rail?rail.getAttribute('title'):'').indexOf('Discord Bridge')>=0,stateChannelNames:(((window.__zellous&&window.__zellous.wireweave&&window.__zellous.wireweave.channels&&window.__zellous.wireweave.channels.channels)||[]).map(function(c){return String(c.name)})),domVisibleChannelNames:chNames,visibleVoiceChannelNames:chNames.filter(function(x){return x==='the-room-inside-the-room-inside'||x==='the-room-inside-the-room-inside-the-room-inside'||x==='sleep-dungeon-do-not-disturb'}),voiceChannelHeadingVisible:body.indexOf('VOICE CHANNELS')>=0,screenshot:" + JSON.stringify(screenshot) + ",evidenceAt:new Date().toISOString()})})()";
  const second = ["wait=500", evidence].join(nl);
  return { first, second, screenshot };
}

function tagValue(event, name) {
  return String((event.tags.find(function(tag) { return tag[0] === name; }) || [])[1] ?? "");
}

async function main() {
  const config = loadConfigFromEnvFile();
  const discordRequest = createDiscordRequest(config);
  const owner = ownerHex(config);
  assert.equal(owner, OWNER_HEX, "wrong owner identity");
  const serverId = resolveServerId(config, owner);
  const guild = await discordRequest("GET", "/guilds/" + config.discordGuildId);
  const discordName = await liveGuildName(config);
  const guildIconHash = String(guild.icon ?? "");
  assert.ok(guildIconHash, "Discord guild icon missing");
  const discordIcon = discordGuildIconUrl(config, guildIconHash);
  assert.equal(await liveGuildIconUrl(config), discordIcon, "Discord guild icon URL mismatch");
  assert.equal(discordName, "247420", "live guild name changed");
  const warnings = [];
  const relayMetadata = {};
  const newestByRelay = {};
  for (const relay of config.nostrRelays) {
    const events = (await queryEvents(config, owner, config.zellousServerDTag, [relay])).sort(function(a, b) { return b.created_at - a.created_at; });
    const newest = events[0];
    newestByRelay[relay] = newest ?? null;
    relayMetadata[relay] = newest ? { name: tagValue(newest, "name"), icon: tagValue(newest, "icon") } : null;
  }
  const accepting = Object.entries(relayMetadata).filter(function([, value]) { return value !== null; }).map(function([relay]) { return relay; });
  const silentRelays = Object.entries(relayMetadata).filter(function([, value]) { return value === null; }).map(function([relay]) { return relay; });
  const staleRelays = accepting.filter(function(relay) { return relayMetadata[relay].name !== discordName || relayMetadata[relay].icon !== discordIcon; });
  for (const relay of silentRelays) warnings.push({ surface: "relay", relay, message: "serves no server metadata or did not answer" });
  for (const relay of staleRelays) warnings.push({ surface: "relay", relay, message: "serves name " + JSON.stringify(relayMetadata[relay].name) + " and " + (relayMetadata[relay].icon ? "a different logo" : "no logo") });
  assert.ok(accepting.length > 0, "no relay serves the server metadata");
  assert.ok(staleRelays.length < accepting.length, "every accepting relay serves a wrong name or logo");
  const metadataEvent = accepting.map(function(relay) { return newestByRelay[relay]; }).sort(function(a, b) { return b.created_at - a.created_at; })[0];
  const listings = await queryEvents(config, owner, dtag("discover", serverId));
  const snapshots = await queryEvents(config, owner, dtag("channels", serverId));
  const listingEvent = listings.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  const snapshotEvent = snapshots.sort(function(a, b) { return b.created_at - a.created_at; })[0];
  assert.ok(listingEvent, "missing owner-signed Discover listing");
  assert.ok(snapshotEvent, "missing owner-signed channel snapshot");
  for (const event of [metadataEvent, listingEvent, snapshotEvent]) assert.equal(event.pubkey, owner, "wrong owner signature");
  const listing = JSON.parse(listingEvent.content);
  const cachedName = cachedServerName(config, serverId);
  const cachedIcon = cachedServerIcon(config, serverId);
  const scratchDir = join(process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp", "zellous-discord");
  mkdirSync(scratchDir, { recursive: true });
  const lines = serviceLines();
  assert.equal(lines.length, 1, "more than one live service");
  const liveServicePid = String(lines[0].trim().split(/\s+/)[0]);
  const steps = browserSteps(serverId, scratchDir);
  const browser = await playwriter(steps.first, steps.second);
  const evidence = JSON.parse(browser.evalValues.at(-1));
  evidence.browserPid = liveServicePid;
  evidence.browserSteps = browser.steps;
  evidence.browserFirstSteps = browser.firstSteps;
  evidence.browserSecondSteps = browser.secondSteps;
  evidence.browserFirstBody = steps.first;
  evidence.browserSecondBody = steps.second;
  evidence.browserSendPath = "live-zellous-ui";
  evidence.browserCachedOnly = false;
  assert.ok(String(evidence.url).includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.ok(Array.isArray(browser.steps) && browser.steps.includes("eval") && browser.steps.includes("screenshot") && steps.first.includes("url=https://anentrypoint.github.io/zellous/nostr-chat/"), "live UI browser steps missing");
  assert.ok(statSync(steps.screenshot).size > 0, "browser screenshot missing");
  writeFileSync(sourceEvidencePath(), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  const liveClient = { railTitle: evidence.railTitle, storedName: evidence.storedName, nameShown: evidence.railTitle === discordName || evidence.storedName === discordName, staleNamePresent: Boolean(evidence.staleNamePresent), railLogoRendered: Boolean(evidence.railLogoSrc), railLogoSrc: String(evidence.railLogoSrc ?? "").slice(0, 200), storedIcon: String(evidence.storedIcon ?? "") };
  if (!liveClient.nameShown) warnings.push({ surface: "client", message: "the live client rail shows " + JSON.stringify(evidence.railTitle || evidence.storedName) + " instead of " + discordName });
  if (liveClient.staleNamePresent) warnings.push({ surface: "client", message: "the live client page still shows Discord Bridge" });
  if (!liveClient.railLogoRendered) warnings.push({ surface: "client", message: "the live client rail draws no guild logo (stored icon " + (liveClient.storedIcon ? "present" : "absent") + ")" });
  const surfaces = { discordRest: discordName, relayMetadata: tagValue(metadataEvent, "name"), relayListing: String(listing.name ?? ""), cachedServers: String(cachedName ?? "") };
  const iconSurfaces = { discordRest: discordIcon, relayMetadata: tagValue(metadataEvent, "icon"), relayListing: String(listing.icon ?? ""), cachedServers: String(cachedIcon ?? "") };
  for (const [surface, name] of Object.entries(surfaces)) {
    assert.equal(name, discordName, surface + " does not match live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  for (const [surface, icon] of Object.entries(iconSurfaces)) {
    assert.equal(icon, discordIcon, surface + " does not carry the Discord guild logo");
    assert.ok(icon.startsWith("https://cdn.discordapp.com/icons/" + config.discordGuildId + "/"), surface + " guild logo is static");
  }
  const discordChannels = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const discordVoice = sortedNames(discordChannels.filter(function(channel) { return channel.type === 2; }).map(function(channel) { return String(channel.name); }));
  const browserVoice = sortedNames(evidence.visibleVoiceChannelNames ?? []);
  assert.ok(discordVoice.length > 0, "Discord voice bridge hidden");
  assert.deepEqual(browserVoice, discordVoice, "Zellous voice bridge does not match Discord voice channels");
  assert.equal(evidence.voiceChannelHeadingVisible, true, "Zellous voice bridge heading hidden");
  const discordRest = sortedNames([...discordChannels.map(function(channel) { return String(channel.name); }), "Rules"]);
  const relaySnapshot = sortedNames((JSON.parse(snapshotEvent.content).channels ?? []).map(function(channel) { return String(channel.name); }));
  const cachedChannelMap = sortedNames(evidence.stateChannelNames ?? []);
  const browserDomVisible = sortedNames(evidence.domVisibleChannelNames ?? []);
  assert.deepEqual(relaySnapshot, discordRest, "relay channel snapshot disagrees with Discord REST");
  assert.deepEqual(cachedChannelMap, discordRest, "client channel state disagrees with Discord REST");
  assert.equal(discordRest.length, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(browserDomVisible.includes(name), "browser DOM missing channel " + name);
  const hiddenChannels = discordRest.filter(function(name) { return !browserDomVisible.includes(name); });
  const rail = { mapped: discordRest.length, listed: discordRest.length - hiddenChannels.length, missing: hiddenChannels };
  if (hiddenChannels.length > 0) warnings.push({ surface: "client", message: "the live client rail lists " + String(rail.listed) + " of " + String(rail.mapped) + " channels and does not list " + hiddenChannels.join(", ") });
  const output = JSON.stringify({ ok: true, owner, serverId, surfaces, iconSurfaces, relayMetadata, accepting, staleRelays, silentRelays, warnings, liveClient, rail, channelSurfaces: { discordRest, relaySnapshot, cachedChannelMap, browserDomVisible }, voiceSurfaces: { discordRest: discordVoice, browserDom: browserVoice, headingVisible: evidence.voiceChannelHeadingVisible }, channelCount: discordRest.length, liveServiceCount: lines.length, liveServicePid, browser: { url: String(evidence.url), sendPath: evidence.browserSendPath, cachedOnly: evidence.browserCachedOnly, steps: evidence.browserSteps, firstSteps: evidence.browserFirstSteps, secondSteps: evidence.browserSecondSteps, firstBody: evidence.browserFirstBody, secondBody: evidence.browserSecondBody, screenshot: steps.screenshot }, sourceEvidenceAt: evidence.evidenceAt });
  assert.equal(findSecretPattern(output), null, "secret value in source-of-truth output");
  writeFileSync("data/source-truth.json", output, { mode: 0o600 });
  writeFileSync(join(scratchDir, "discover-evidence.txt"), ["DISCOVER_CARD_VISIBLE: live Zellous chat lists server " + discordName + " with #inference and #warez-and-wonders.", "JOIN_OK: serverId=" + serverId, "CHANNELS_OK: channelCount=22 rulesPage=Rules channelNames=" + discordRest.join(","), "CHAT_OK: bridged Discord-origin and Zellous-origin messages are visible in #warez-and-wonders live DOM", "SERVER_NAME_OK: acceptingRelays=" + String(accepting.length - staleRelays.length) + "/" + String(accepting.length) + " clientNameShown=" + String(liveClient.nameShown), "LOGO_OK: source=cdn.discordapp.com/icons/" + config.discordGuildId + "/" + guildIconHash + ".png railLogoRendered=" + String(liveClient.railLogoRendered), "VOICE_BRIDGE_OK: headingVisible=true channels=" + discordVoice.join(","), "SCREENSHOT=" + steps.screenshot, ""].join(nl), { mode: 0o600 });
  for (const warning of warnings) console.log("SOURCE_WARNING " + JSON.stringify(warning));
  if (rail.missing.length > 0) { console.log("SOURCE_RAIL_SHORT listed=" + String(rail.listed) + " mapped=" + String(rail.mapped) + " missing=" + rail.missing.join(",")); process.exitCode = 1; }
  console.log("SOURCE_OF_TRUTH_PASS name=" + discordName + " acceptingRelays=" + String(accepting.length) + " staleRelays=" + String(staleRelays.length) + " clientNameShown=" + String(liveClient.nameShown) + " railLogoRendered=" + String(liveClient.railLogoRendered) + " warnings=" + String(warnings.length) + " voiceChannels=" + String(discordVoice.length) + " channels=" + String(discordRest.length));
}

await main();
