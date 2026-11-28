import test from "node:test";
import assert from "node:assert/strict";
import { discordRequest } from "../../src/adapters/discord.js";
import type { Config } from "../../src/config.js";

const config = { discordToken: { reveal: function() { return "control-token"; } } } as unknown as Config;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("control-plane Discord REST retries a 429 and then succeeds", async function() {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function() {
    calls += 1;
    if (calls === 1) return jsonResponse({ retry_after: 0 }, 429);
    return jsonResponse({ ok: true }, 200);
  };
  try {
    const result = await discordRequest(config, "GET", "/guilds/1/channels");
    assert.deepEqual(result, { ok: true });
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

test("control-plane Discord REST stops after bounded 429 attempts", async function() {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function() {
    calls += 1;
    return jsonResponse({ retry_after: 0 }, 429);
  };
  try {
    await assert.rejects(discordRequest(config, "GET", "/guilds/1/channels"), /rate limit persisted/);
    assert.equal(calls, 8);
  } finally { globalThis.fetch = original; }
});

test("control-plane Discord REST fails on a non-rate-limit error", async function() {
  const original = globalThis.fetch;
  globalThis.fetch = async function() { return jsonResponse({ message: "missing" }, 404); };
  try {
    await assert.rejects(discordRequest(config, "GET", "/channels/missing/messages"), /status 404/);
  } finally { globalThis.fetch = original; }
});
