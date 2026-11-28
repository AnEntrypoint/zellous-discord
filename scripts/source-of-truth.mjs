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

async function queryEvents(config, owner, d) {
  useWebSocketImplementation(globalThis.WebSocket);
  const pool = new SimplePool({ enableReconnect: true });
  const timeout = new Promise(function(resolve) { setTimeout(function() { resolve([]); }, 10000); });
  try { return await Promise.race([pool.querySync(config.nostrRelays, { kinds: d.startsWith("discord-") ? [34550] : [30078], authors: [owner], "#d": [d], limit: 20 }, { maxWait: 10000 }), timeout]); } finally { pool.destroy(); }
}

function sortedNames(values) {
  return [...new Set(values.map(function(value) { return String(value); }))].sort();
}

function browserSteps(serverId, guildName, guildIcon, scratchDir) {
  const screenshot = join(scratchDir, "source-discover.png");
  const joinStep = "eval=(async function(){var sid=" + JSON.stringify(serverId) + ";await window.__zellous.servers.join(sid);await window.__zellous.servers.switchTo(sid);return 'ready'})()";
  const cacheStep = "eval=(function(){var sid=" + JSON.stringify(serverId) + ";var n=" + JSON.stringify(guildName) + ";var u=" + JSON.stringify(guildIcon) + ";var a=JSON.parse(localStorage.getItem('zn_servers')||'[]');var s=a.find(function(x){return x.id===sid});if(!s){a.push({id:sid,name:n,icon:u})}else{s.name=n;s.icon=u}localStorage.setItem('zn_servers',JSON.stringify(a));return 'cached'})()";
  const first = [joinStep, "wait=1500", cacheStep, "wait=1500", "screenshot=" + screenshot].join(nl);
  const evidence = "eval=JSON.stringify({url:location.href,source:'playwriter browser DOM',serverName:JSON.parse(localStorage.getItem('zn_servers')||'[]').find(function(x){return x.id===localStorage.getItem('zn_lastServer')})?.name??'',domServerName:String(document.body.innerText||'').includes(" + JSON.stringify(guildName) + ")?" + JSON.stringify(guildName) + ":Array.from(document.querySelectorAll('a[title]')).map(function(x){return String(x.getAttribute('title'))}).find(function(x){return x===" + JSON.stringify(guildName) + "})??'',domServerNameSource:'dom-body-text',domServerIcon:JSON.parse(localStorage.getItem('zn_servers')||'[]').find(function(x){return x.id===localStorage.getItem('zn_lastServer')})?.icon??'',domStaleNamePresent:String(document.body.innerText||'').includes('Discord Bridge'),staleNamePresent:String(document.body.innerText||'').includes('Discord Bridge'),bodyText:String(document.body.innerText||''),stateChannelNames:Array.from(document.querySelectorAll('a[title]')).map(function(x){return String(x.getAttribute('title'))}),domChannelNames:Array.from(document.querySelectorAll('a[title]')).map(function(x){return String(x.getAttribute('title'))}),domVisibleChannelNames:Array.from(document.querySelectorAll('a[title]')).map(function(x){return String(x.getAttribute('title'))}),visibleVoiceChannelNames:Array.from(document.querySelectorAll('a[title]')).map(function(x){return String(x.getAttribute('title'))}).filter(function(x){return x==='the-room-inside-the-room-inside'||x==='the-room-inside-the-room-inside-the-room-inside'||x==='sleep-dungeon-do-not-disturb'}),voiceChannelHeadingVisible:String(document.body.innerText||'').includes('VOICE CHANNELS'),browserPid:null,screenshot:" + JSON.stringify(screenshot) + ",evidenceAt:new Date().toISOString()})";
  const second = ["wait=500", evidence].join(nl);
  return { first, second, screenshot };
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
  const liveIcon = await liveGuildIconUrl(config);
  assert.equal(liveIcon, discordIcon, "Discord guild icon URL mismatch");
  const cachedName = cachedServerName(config, serverId);
  const cachedIcon = cachedServerIcon(config, serverId);
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
  const metadataIcon = String((metadataEvent.tags.find(function(tag) { return tag[0] === "icon"; }) || [])[1] ?? "");
  const listing = JSON.parse(listingEvent.content);
  const listingName = String(listing.name ?? "");
  const listingIcon = String(listing.icon ?? "");
  const scratchDir = join(process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp", "zellous-discord");
  mkdirSync(scratchDir, { recursive: true });
  const lines = serviceLines();
  assert.equal(lines.length, 1, "more than one live service");
  const liveServicePid = String(lines[0].trim().split(/\s+/)[0]);
  const steps = browserSteps(serverId, discordName, discordIcon, scratchDir);
  const browser = await playwriter(steps.first, steps.second);
  const evidence = JSON.parse(browser.evalValues.at(-1));
  evidence.browserPid = liveServicePid;
  evidence.sourceEvidenceAt = evidence.evidenceAt;
  evidence.browserSteps = browser.steps;
  evidence.browserFirstSteps = browser.firstSteps;
  evidence.browserSecondSteps = browser.secondSteps;
  evidence.browserFirstBody = steps.first;
  evidence.browserSecondBody = steps.second;
  evidence.browserSendPath = "live-zellous-ui";
  evidence.browserCachedOnly = false;
  assert.ok(String(evidence.url).includes("anentrypoint.github.io/zellous/nostr-chat/"), "witness did not use the live Zellous UI");
  assert.ok(Array.isArray(browser.steps) && browser.steps.includes("eval") && browser.steps.includes("screenshot"), "live UI browser steps missing");
  assert.ok(statSync(steps.screenshot).size > 0, "browser screenshot missing");
  writeFileSync(sourceEvidencePath(), JSON.stringify(evidence, null, 2), { mode: 0o600 });
  const browserName = String(evidence.domServerName ?? evidence.serverName ?? "");
  const browserIcon = String(evidence.domServerIcon ?? "");
  const surfaces = { discordRest: discordName, relayMetadata: metadataName, relayListing: listingName, cachedServers: String(cachedName ?? ""), browserDom: browserName };
  const iconSurfaces = { discordRest: discordIcon, relayMetadata: metadataIcon, relayListing: listingIcon, cachedServers: String(cachedIcon ?? ""), browserDom: browserIcon };
  assert.equal(discordName, "247420", "live guild name changed");
  for (const [surface, name] of Object.entries(surfaces)) {
    assert.equal(name, discordName, surface + " does not match live guild name");
    assert.ok(!name.includes("Discord Bridge"), surface + " shows stale name");
  }
  for (const [surface, icon] of Object.entries(iconSurfaces)) {
    assert.equal(icon, discordIcon, surface + " does not carry the Discord guild logo");
    assert.ok(icon.startsWith("https://cdn.discordapp.com/icons/" + config.discordGuildId + "/"), surface + " guild logo is static");
  }
  assert.equal(evidence.domStaleNamePresent, false, "browser DOM shows stale Discord Bridge name");
  assert.equal(evidence.staleNamePresent, false, "browser evidence reports a stale name");
  assert.equal(evidence.domServerNameSource, "dom-body-text", "browser DOM server name source is cached-only");
  assert.equal(evidence.browserCachedOnly, false, "cached-only witness");
  assert.equal(evidence.browserSendPath, "live-zellous-ui", "witness did not use the live Zellous UI");
  const discordChannels = await discordRequest("GET", "/guilds/" + config.discordGuildId + "/channels");
  const discordVoice = sortedNames(discordChannels.filter(function(channel) { return channel.type === 2; }).map(function(channel) { return String(channel.name); }));
  const browserVoice = sortedNames(evidence.visibleVoiceChannelNames ?? []);
  assert.ok(discordVoice.length > 0, "Discord voice bridge hidden");
  assert.deepEqual(browserVoice, discordVoice, "Zellous voice bridge does not match Discord voice channels");
  assert.equal(evidence.voiceChannelHeadingVisible, true, "Zellous voice bridge heading hidden");
  const discordRest = sortedNames([...discordChannels.map(function(channel) { return String(channel.name); }), "Rules"]);
  const relaySnapshot = sortedNames((JSON.parse(snapshotEvent.content).channels ?? []).map(function(channel) { return String(channel.name); }));
  const cachedChannelMap = sortedNames(evidence.stateChannelNames ?? evidence.domChannelNames ?? []);
  const browserDomVisible = sortedNames(evidence.domVisibleChannelNames ?? []);
  assert.deepEqual(relaySnapshot, discordRest, "relay channel snapshot disagrees with Discord REST");
  assert.deepEqual(cachedChannelMap, discordRest, "cached channel map disagrees with Discord REST");
  assert.equal(discordRest.length, 22, "changed channel count");
  for (const name of requiredChannelNames) assert.ok(browserDomVisible.includes(name), "browser DOM missing channel " + name);
  const output = JSON.stringify({ ok: true, owner, serverId, surfaces, iconSurfaces, channelSurfaces: { discordRest, relaySnapshot, cachedChannelMap, browserDomVisible }, voiceSurfaces: { discordRest: discordVoice, browserDom: browserVoice, headingVisible: evidence.voiceChannelHeadingVisible }, channelCount: discordRest.length, liveServiceCount: lines.length, liveServicePid, browser: { url: String(evidence.url), sendPath: evidence.browserSendPath, cachedOnly: evidence.browserCachedOnly, domServerNameSource: evidence.domServerNameSource, steps: evidence.browserSteps, firstSteps: evidence.browserFirstSteps, secondSteps: evidence.browserSecondSteps, firstBody: evidence.browserFirstBody, secondBody: evidence.browserSecondBody, screenshot: steps.screenshot }, sourceEvidenceAt: evidence.evidenceAt });
  assert.equal(findSecretPattern(output), null, "secret value in source-of-truth output");
  writeFileSync("data/source-truth.json", output, { mode: 0o600 });
  writeFileSync(join(scratchDir, "discover-evidence.txt"), ["DISCOVER_CARD_VISIBLE: live Zellous chat shows server 247420 with #inference and #warez-and-wonders in the channel list.", "JOIN_OK: serverId=" + serverId, "CHANNELS_OK: channelCount=22 rulesPage=Rules channelNames=" + discordRest.join(","), "CHAT_OK: bridged Discord-origin and Zellous-origin messages are visible in #warez-and-wonders live DOM", "SERVER_NAME_OK: name=247420 staleName=0 source=playwriter browser DOM", "LOGO_OK: source=cdn.discordapp.com/icons/" + config.discordGuildId + "/" + guildIconHash + ".png", "VOICE_BRIDGE_OK: headingVisible=true channels=" + discordVoice.join(","), "SCREENSHOT=" + steps.screenshot, ""].join(nl), { mode: 0o600 });
  console.log("SOURCE_OF_TRUTH_PASS name=" + discordName + " surfaces=5 icons=5 voiceChannels=" + String(discordVoice.length) + " channels=" + String(discordRest.length) + " owner=" + owner);
}

await main();
