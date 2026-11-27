import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { BridgeEchoStore } from "../../src/sync/echo.js";
import { mapGatewayMessageToDiscordLike, stableDiscordVersion } from "../../src/mappers.js";

test("gateway message maps to stable native fields", function() {
  const message = { id: "123456789012345678", content: "hello", createdTimestamp: 1700000000000, editedTimestamp: null, author: { id: "42", username: "user" }, attachments: new Map(), mentions: { users: new Map() }, reactions: { cache: new Map() } };
  const mapped = mapGatewayMessageToDiscordLike(message);
  assert.equal(mapped.id, message.id);
  assert.equal(mapped.content, "hello");
  assert.equal(mapped.timestamp, message.createdTimestamp);
  assert.equal(stableDiscordVersion(message.id), Number(BigInt(message.id) >> 22n));
});

test("bridge echo store persists stable native ids", function() {
  const dir = join("/config/workspace/tmp/zellous-discord/tests", randomUUID());
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const store = new BridgeEchoStore(dir);
  store.rememberDiscord("discord-id");
  store.rememberZellous("zellous-id");
  store.rememberNonce("zdb-nonce");
  const reopened = new BridgeEchoStore(dir);
  assert.equal(reopened.isDiscord("discord-id"), true);
  assert.equal(reopened.isZellous("zellous-id"), true);
  assert.equal(reopened.isNonce("zdb-nonce"), true);
  rmSync(dir, { recursive: true, force: true });
});
