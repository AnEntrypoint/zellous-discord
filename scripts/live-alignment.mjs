import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const nl = String.fromCharCode(10);
const livePin = "2e364df5f45b29e8f5cf6e747a0c2e9781352e0d";
const devPin = "4508d66ff4cd3fde31959cc8b998810f367be321";
const liveRelays = ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol", "wss://relay.snort.social"];
const liveRelayText = liveRelays.join(",");
const pagesIndex = "https://anentrypoint.github.io/zellous/nostr-chat/index.html";
const pagesBridge = "https://anentrypoint.github.io/zellous/js/wireweave-bridge.js";
const changedFiles = ["src/modules/voice-thread.js", "src/vad/clip-filter.js", "src/vad/detector.js", "src/voice-thread-audio.js", "src/voice.js"];
const allowedDevPinFiles = new Set(["AGENTS.md", "docs/PROTOCOL.md", "docs/RESEARCH.md", "docs/LIVE_PIN_DIFF.md", "src/config.ts", "scripts/live-alignment.mjs", "test/unit/live-alignment.test.ts"]);
const requiredVoiceFields = ["relay", "streamId", "src", "muteMs", "unmuteMs", "fragment", "clipSpliced", "relayed", "remoteKeys"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch failed " + String(response.status) + " " + url);
  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("fetch failed " + String(response.status) + " " + url);
  return response.json();
}

function extractPin(indexText) {
  const key = "wireweave@";
  const start = indexText.indexOf(key) + key.length;
  return indexText.slice(start, start + 40);
}

function extractRelays(bridgeText) {
  const key = "state.nostrRelays || [";
  const start = bridgeText.indexOf(key) + key.length;
  const end = bridgeText.indexOf("]", start);
  const quote = String.fromCharCode(34);
  const apostrophe = String.fromCharCode(39);
  return bridgeText.slice(start, end).split(",").map(function(part) { return part.trim().split(quote).join("").split(apostrophe).join(""); }).filter(Boolean);
}

function trackedFiles() {
  const tracked = execFileSync("git", ["ls-files"]).toString().trim().split(nl);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard"]).toString().trim().split(nl);
  return [...new Set([...tracked, ...untracked])].filter(Boolean);
}

function readTracked() {
  const result = new Map();
  for (const file of trackedFiles()) {
    if (file === "package-lock.json") continue;
    result.set(file, readFileSync(file, "utf8"));
  }
  return result;
}

function assertLiveArtifacts(indexText, bridgeText) {
  assert(extractPin(indexText) === livePin, "live Pages pin mismatch");
  assert(JSON.stringify(extractRelays(bridgeText)) === JSON.stringify(liveRelays), "live Pages relay default mismatch");
}

function assertNoStaleDevPin(files) {
  for (const [file, text] of files) {
    if (allowedDevPinFiles.has(file)) continue;
    assert(text.indexOf(devPin) < 0, "stale development pin in " + file);
  }
}

function assertLivePin(files) {
  assert(files.get("package.json").indexOf(livePin) >= 0, "package.json missing live pin");
  assert(files.get("src/config.ts").indexOf("LIVE_WIREWEAVE_PIN") >= 0, "config missing live pin constant");
  assert(files.get("src/config.ts").indexOf(livePin) >= 0, "config missing live pin value");
  assert(files.get("docs/PROTOCOL.md").indexOf(livePin) >= 0, "protocol contract missing live pin");
  assert(files.get("docs/RESEARCH.md").indexOf(livePin) >= 0, "research missing live pin");
  assert(files.get("docs/LIVE_PIN_DIFF.md").indexOf(livePin) >= 0, "diff document missing live pin");
}

function assertRelayDefault(files) {
  const env = files.get(".env.example");
  const config = files.get("src/config.ts");
  assert(env.indexOf("NOSTR_RELAYS=" + liveRelayText) >= 0, "env example missing live relay default");
  assert(env.indexOf("ZELLOUS_RELAYS=") >= 0, "env example missing ZELLOUS_RELAYS");
  assert(config.indexOf("ZELLOUS_RELAYS") >= 0, "config missing ZELLOUS_RELAYS");
  for (const relay of liveRelays) assert(config.indexOf(relay) >= 0, "config missing live relay " + relay);
  assert(config.indexOf("wss://offchain.pub") < 0, "config retains development relay wss://offchain.pub");
  assert(config.indexOf("wss://nostr-pub.wellorder.net") < 0, "config retains development relay wss://nostr-pub.wellorder.net");
}

function assertProtocolReconciled(changed, files) {
  assert(JSON.stringify(changed) === JSON.stringify(changedFiles), "unresolved protocol difference: changed file set differs");
  const diff = files.get("docs/LIVE_PIN_DIFF.md");
  for (const file of changed) assert(diff.indexOf(file + " reconciled") >= 0, "unresolved protocol difference: " + file);
  const contract = files.get("src/contract.ts");
  const protocol = files.get("docs/PROTOCOL.md");
  const types = files.get("src/types.ts");
  const webrtc = files.get("src/voice/webrtc.ts");
  assert(types.indexOf(" | " + String.fromCharCode(34) + "relay" + String.fromCharCode(34)) >= 0, "VoiceSignal missing relay signal type");
  assert(webrtc.indexOf(" | " + String.fromCharCode(34) + "relay" + String.fromCharCode(34)) >= 0, "WeriftVoicePeer missing relay signal type");
  for (const field of requiredVoiceFields) {
    assert(contract.indexOf(field) >= 0, "contract missing voice field " + field);
    assert(protocol.indexOf(field) >= 0, "protocol missing voice field " + field);
  }
}

async function protocolTree(sha) {
  const json = await fetchJson("https://api.github.com/repos/AnEntrypoint/wireweave/git/trees/" + sha + "?recursive=1");
  const result = new Map();
  for (const item of json.tree || []) if (item.type === "blob" && item.path.indexOf("src/") === 0) result.set(item.path, item.sha);
  return result;
}

async function protocolDiff() {
  const live = await protocolTree(livePin);
  const dev = await protocolTree(devPin);
  const paths = [...new Set([...live.keys(), ...dev.keys()])].sort();
  return paths.filter(function(path) { return live.get(path) !== dev.get(path); });
}

function expectThrow(operation, label) {
  let threw = false;
  try { operation(); } catch { threw = true; }
  assert(threw, label + " did not fail");
}

function selfTest() {
  const stale = new Map([["package.json", "github:AnEntrypoint/wireweave#" + devPin]]);
  expectThrow(function() { assertNoStaleDevPin(stale); }, "stale development pin");
  const missingRelay = new Map([
    [".env.example", "NOSTR_RELAYS=wss://relay.damus.io" + nl + "ZELLOUS_RELAYS="],
    ["src/config.ts", "ZELLOUS_RELAYS" + nl + "wss://relay.damus.io"]
  ]);
  expectThrow(function() { assertRelayDefault(missingRelay); }, "missing live relay default");
  const unresolved = new Map([
    ["docs/LIVE_PIN_DIFF.md", "src/chat.js reconciled"],
    ["src/contract.ts", requiredVoiceFields.join(",")],
    ["docs/PROTOCOL.md", requiredVoiceFields.join(",")],
    ["src/types.ts", " | " + String.fromCharCode(34) + "relay" + String.fromCharCode(34)],
    ["src/voice/webrtc.ts", " | " + String.fromCharCode(34) + "relay" + String.fromCharCode(34)]
  ]);
  expectThrow(function() { assertProtocolReconciled(["src/unexpected.js"], unresolved); }, "unresolved protocol difference");
  console.log("LIVE_ALIGNMENT_SELF_TEST_PASS");
}

async function main() {
  if (process.argv.includes("--self-test")) {
    selfTest();
    return;
  }
  const files = readTracked();
  const indexText = await fetchText(pagesIndex);
  const bridgeText = await fetchText(pagesBridge);
  assertLiveArtifacts(indexText, bridgeText);
  assertNoStaleDevPin(files);
  assertLivePin(files);
  assertRelayDefault(files);
  const changed = await protocolDiff();
  assertProtocolReconciled(changed, files);
  console.log("LIVE_ALIGNMENT_PASS pin=" + livePin + " relays=" + String(liveRelays.length) + " protocolChangedFiles=" + String(changed.length));
}

await main();