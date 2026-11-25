import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { VoiceIdentityLedger } from "../../src/voice/identity.js";

const scratchRoot = "/config/workspace/tmp/zellous-discord/tests";

test("per-user voice identities are distinct and stable across restart", () => {
  const dir = join(scratchRoot, randomUUID());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const first = new VoiceIdentityLedger(dir);
  const a = first.resolve("discord", "user-1");
  const b = first.resolve("discord", "user-2");
  assert.notEqual(a.pubkey, b.pubkey);
  const reopened = new VoiceIdentityLedger(dir);
  assert.equal(reopened.resolve("discord", "user-1").pubkey, a.pubkey);
  assert.equal(reopened.count(), 2);
  rmSync(dir, { recursive: true, force: true });
});