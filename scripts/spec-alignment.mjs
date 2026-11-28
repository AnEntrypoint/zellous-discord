import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const docs = ["docs/SPEC_ALIGNMENT.md", "docs/PROTOCOL.md", "docs/RESEARCH.md", "docs/LIVE_PIN_DIFF.md", "AGENTS.md", "README.md"];
const texts = new Map(docs.map(function(file) { return [file, readFileSync(file, "utf8")]; }));
const all = [...texts.values()].join(String.fromCharCode(10));
const needles = [
  "4b73168fbfbb2f13f11e56e368244166955f6af2",
  "115f7da3034a79662887fc4a45d3c3b1224bb43a",
  "a370a9b15d9c3fa916e7312df6682d0a27cc2293",
  "f944146955ca886370f3de464865f311998cb25b",
  "8a4a5002d878e6f849068106a92339f0f6be02dc",
  "2e364df5f45b29e8f5cf6e747a0c2e9781352e0d",
  "4508d66ff4cd3fde31959cc8b998810f367be321",
  "src/hub-liveness.js",
  "174 extra Discord channels",
  "reversible new-snapshot reconciliation",
  "destructive cleanup",
  "owner-authorized reversible duplicate cleanup",
  "cleanup-backup.json",
  "cleanup-rollback",
  "cleanup:red-check",
  "BridgeEchoStore",
  "VoiceReflection",
  "text:marker",
  "voice:red-check",
  "Portal intent approval and relay-set confirmation are not held",
  "text reflection works with privileged intents off",
  "one bot identity reflects a mix",
  "voicePoolState=ready",
  "active acceptance claim is stopped",
  "voice proof is held until real frames flow in both directions",
  "DISCORD_PRIVILEGED_INTENTS=false",
  "wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social",
  "988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711",
  "BRIDGE_PRIVATE_KEY_HEX",
  "zellous-discover",
  "I reported, verbatim"
];

function assertAlignment(text) {
  for (const needle of needles) assert.ok(text.indexOf(needle) >= 0, "missing spec alignment " + needle);
  assert.ok(texts.get("docs/SPEC_ALIGNMENT.md").indexOf("it is historical only") >= 0, "earlier pin must be historical");
}

function selfTest() {
  let threw = false;
  try { assertAlignment(all.split("174 extra Discord channels").join("unknown extra channels")); } catch { threw = true; }
  assert.ok(threw, "stale duplicate-channel fact did not fail");
  threw = false;
  try { assertAlignment(all.split("988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711").join("wrong-owner")); } catch { threw = true; }
  assert.ok(threw, "wrong owner identity did not fail");
  threw = false;
  try { assertAlignment(all.split("owner-authorized reversible duplicate cleanup").join("unknown cleanup")); } catch { threw = true; }
  assert.ok(threw, "owner cleanup fact did not fail");
  threw = false;
  try { assertAlignment(all.split("VoiceReflection").join("UnknownReflection")); } catch { threw = true; }
  assert.ok(threw, "voice reflection fact did not fail");
  threw = false;
  try { assertAlignment(all.split("Portal intent approval and relay-set confirmation are not held").join("Portal approval is held")); } catch { threw = true; }
  assert.ok(threw, "held direction did not fail");
  threw = false;
  try { assertAlignment(all.split("voicePoolState=ready").join("voicePoolState=insufficient")); } catch { threw = true; }
  assert.ok(threw, "one-identity ready pool did not fail");
  threw = false;
  try { assertAlignment(all.split("one bot identity reflects a mix").join("two identities are required")); } catch { threw = true; }
  assert.ok(threw, "one mixing identity fact did not fail");
  threw = false;
  try { assertAlignment(all.split("active acceptance claim is stopped").join("acceptance claim active")); } catch { threw = true; }
  assert.ok(threw, "held acceptance state did not fail");
  threw = false;
  try { assertAlignment(all.split("I reported, verbatim").join("third-person report")); } catch { threw = true; }
  assert.ok(threw, "first-person requirement did not fail");
  threw = false;
  try { assertAlignment(all.split("4b73168fbfbb2f13f11e56e368244166955f6af2").join("wrong-live-pin")); } catch { threw = true; }
  assert.ok(threw, "current live pin did not fail");
  console.log("SPEC_ALIGNMENT_SELF_TEST_PASS");
}

if (process.argv.includes("--self-test")) selfTest();
else {
  assertAlignment(all);
  console.log("SPEC_ALIGNMENT_PASS docs=" + String(docs.length) + " currentPin=4b73168fbfbb2f13f11e56e368244166955f6af2");
}
