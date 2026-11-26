import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const docs = ["docs/SPEC_ALIGNMENT.md", "docs/PROTOCOL.md", "docs/RESEARCH.md", "docs/LIVE_PIN_DIFF.md", "AGENTS.md"];
const texts = new Map(docs.map(function(file) { return [file, readFileSync(file, "utf8")]; }));
const all = [...texts.values()].join(String.fromCharCode(10));
const needles = [
  "5d451241587181e471e263f44db993ba8e2d5764",
  "2e364df5f45b29e8f5cf6e747a0c2e9781352e0d",
  "4508d66ff4cd3fde31959cc8b998810f367be321",
  "src/hub-liveness.js",
  "174 extra Discord channels",
  "reversible new-snapshot reconciliation",
  "no destructive cleanup",
  "DISCORD_PRIVILEGED_INTENTS=false",
  "wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social"
];

function assertAlignment(text) {
  for (const needle of needles) assert.ok(text.indexOf(needle) >= 0, "missing spec alignment " + needle);
  assert.ok(text.indexOf("5d451241587181e471e263f44db993ba8e2d5764") > text.indexOf("2e364df5f45b29e8f5cf6e747a0c2e9781352e0d"), "earlier pin must be historical");
}

function selfTest() {
  let threw = false;
  try { assertAlignment(all.replace("174 extra Discord channels", "unknown extra channels")); } catch { threw = true; }
  assert.ok(threw, "stale duplicate-channel fact did not fail");
  console.log("SPEC_ALIGNMENT_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  assertAlignment(all);
  console.log("SPEC_ALIGNMENT_PASS docs=" + String(docs.length) + " currentPin=5d451241587181e471e263f44db993ba8e2d5764");
}