import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { findSecretPattern } from "../dist/redaction.js";
import { createDiscordRequest } from "./discord-rest.mjs";
import { playwriter } from "./playwriter.mjs";

const nl = String.fromCharCode(10);
const channelId = "805320534370943016";

export function assertAttribution(row, username, marker) {
  assert.ok(String(row.text).includes(marker), "marker not shown in the live Zellous channel");
  assert.ok(String(row.text).includes(username), "Zellous row does not show the Discord username " + username);
  assert.ok(!/\bbridge\b/i.test(String(row.author)) || String(row.author).includes(username), "Zellous row shows a generic bridge author");
}

function selfTest() {
  const marker = "zdb-attr-x";
  assertAttribution({ text: "alice 10:00 " + marker, author: "alice" }, "alice", marker);
  const cases = [
    [{ text: "bob 10:00 " + marker, author: "bob" }, "alice", "wrong username did not fail"],
    [{ text: "10:00 " + marker, author: "" }, "alice", "missing username did not fail"],
    [{ text: "alice 10:00", author: "alice" }, "alice", "missing marker did not fail"],
    [{ text: "bridge 10:00 " + marker, author: "bridge" }, "alice", "generic bridge author did not fail"]
  ];
  for (const [row, username, label] of cases) {
    let threw = false;
    try { assertAttribution(row, username, marker); } catch { threw = true; }
    assert.ok(threw, label);
  }
  console.log("ATTRIBUTION_SELF_TEST_PASS cases=" + String(cases.length + 1));
}

async function main() {
  const config = loadConfigFromEnvFile();
  const rest = createDiscordRequest(config);
  const serverId = resolveServerId(config, ownerHex(config));
  const marker = "zdb-attr-" + randomUUID();
  const created = await rest("POST", "/channels/" + channelId + "/messages", { content: marker, allowed_mentions: { parse: [] } });
  const username = String(created.author?.global_name || created.author?.username || "");
  assert.ok(username, "Discord author username missing");
  try {
    await new Promise(function(resolve) { setTimeout(resolve, 8000); });
    const join = "eval=(async function(){var sid=" + JSON.stringify(serverId) + ";await window.__zellous.servers.join(sid);await window.__zellous.servers.switchTo(sid);return 'ready'})()";
    const open = "eval=(function(){var a=Array.from(document.querySelectorAll('a[title]')).find(function(x){return x.getAttribute('title')==='warez-and-wonders'});if(!a)return 'missing channel';a.click();return 'clicked'})()";
    const probe = "eval=(function(){var m=" + JSON.stringify(marker) + ";var els=Array.from(document.querySelectorAll('*')).filter(function(e){return e.children.length===0&&String(e.textContent||'').indexOf(m)>=0});var el=els[0];if(!el)return JSON.stringify({text:'',author:''});var row=el;for(var i=0;i<6&&row.parentElement;i+=1){row=row.parentElement;if(String(row.innerText||'').length>m.length+4)break}var author=row.querySelector('[class*=author],[class*=name],[class*=user]');return JSON.stringify({text:String(row.innerText||'').replace(/\\n+/g,' | ').slice(0,300),author:author?String(author.innerText||'').slice(0,80):''})})()";
    const result = await playwriter(["url=https://anentrypoint.github.io/zellous/nostr-chat/", "wait=9000", join, "wait=6000", open, "wait=9000"].join(nl), ["wait=500", probe].join(nl));
    const row = JSON.parse(result.secondEvalValues.at(-1));
    assertAttribution(row, username, marker);
    const output = JSON.stringify({ username, row });
    assert.equal(findSecretPattern(output), null, "secret value in output");
    console.log("ATTRIBUTION_PASS username=" + username + " row=" + row.text);
  } finally { await rest("DELETE", "/channels/" + channelId + "/messages/" + created.id).catch(function() {}); }
}

if (process.argv.includes("--self-test")) selfTest();
else await main();
