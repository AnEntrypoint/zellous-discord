import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEVELOPMENT_WIREWEAVE_PIN, LIVE_DEFAULT_RELAYS, LIVE_WIREWEAVE_PIN } from "../../src/config.js";
import { VOICE_FIELDS } from "../../src/contract.js";

test("Stage 5 uses the live Pages pin and four-relay default", () => {
  assert.equal(LIVE_WIREWEAVE_PIN, "8a4a5002d878e6f849068106a92339f0f6be02dc");
  assert.equal(DEVELOPMENT_WIREWEAVE_PIN, "4508d66ff4cd3fde31959cc8b998810f367be321");
  assert.deepEqual(LIVE_DEFAULT_RELAYS, ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nos.lol", "wss://relay.snort.social"]);
});

test("Stage 5 reconciles every live-pin protocol difference", () => {
  const diff = readFileSync("docs/LIVE_PIN_DIFF.md", "utf8");
  const protocol = readFileSync("docs/PROTOCOL.md", "utf8");
  const changed = ["src/hub-liveness.js", "src/modules/voice-thread.js", "src/vad/clip-filter.js", "src/vad/detector.js", "src/voice-thread-audio.js", "src/voice.js"];
  for (const file of changed) assert.ok(diff.includes(file + " reconciled"), "missing reconciliation for " + file);
  for (const field of VOICE_FIELDS) assert.ok(protocol.includes(field), "protocol missing " + field);
  for (const field of ["relay", "streamId", "src", "muteMs", "unmuteMs", "fragment", "clipSpliced", "relayed", "remoteKeys"]) assert.ok(VOICE_FIELDS.includes(field));
});