import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCanonicalEvent } from "../../src/canonical.js";
import { ALL_CONTRACT_FIELDS, CONTRACT_VERSION, validateCanonicalEvent } from "../../src/contract.js";

test("protocol document names every canonical field", () => {
  const document = readFileSync("docs/PROTOCOL.md", "utf8");
  for (const field of ALL_CONTRACT_FIELDS) assert.ok(document.includes(field), "missing field " + field);
});

test("canonical event validation accepts a complete room envelope", () => {
  const event = createCanonicalEvent({
    schemaVersion: CONTRACT_VERSION,
    source: "discord",
    sourceId: "channel-1",
    operation: "room.create",
    version: 1,
    occurredAt: Date.now(),
    actor: { source: "discord", sourceUserId: "user-1", bridgePubkey: null, displayName: "User", avatarUrl: null },
    room: {
      roomId: "room-1",
      discordId: "channel-1",
      zellousId: null,
      serverId: "pubkey:discord",
      guildId: "367741339393327104",
      type: "text",
      parentId: null,
      position: 0,
      name: "general",
      topic: null
    },
    payload: { roomId: "room-1" },
    suppressionKey: null,
    tracing: []
  });
  assert.deepEqual(validateCanonicalEvent(event), []);
});

test("canonical event validation rejects a room operation without room", () => {
  const event = createCanonicalEvent({
    schemaVersion: CONTRACT_VERSION,
    source: "discord",
    sourceId: "channel-1",
    operation: "room.create",
    version: 1,
    occurredAt: Date.now(),
    actor: { source: "discord", sourceUserId: "user-1", bridgePubkey: null, displayName: "User", avatarUrl: null },
    room: null,
    payload: {},
    suppressionKey: null,
    tracing: []
  });
  assert.ok(validateCanonicalEvent(event).length > 0);
});