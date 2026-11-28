import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanonicalEvent } from "../../src/canonical.js";
import { loadConfig } from "../../src/config.js";
import { Logger } from "../../src/logger.js";
import { VoiceReflection } from "../../src/voice/reflection.js";

function voiceEvent(operation: "voice.join" | "voice.leave", voice: Record<string, unknown>, version: number) {
  return createCanonicalEvent({ schemaVersion: 1, source: String(voice.userId).startsWith("zellous:") ? "zellous" : "discord", sourceId: String(voice.userId), operation, version, occurredAt: version, actor: { source: String(voice.userId).startsWith("zellous:") ? "zellous" : "discord", sourceUserId: "bridge", bridgePubkey: null, displayName: "bridge", avatarUrl: null }, room: null, payload: { voice }, suppressionKey: null, tracing: ["discord"] } as never);
}

function reflection(tokens: string) {
  const dir = mkdtempSync(join(tmpdir(), "zdb-voice-"));
  const config = loadConfig({ DISCORD_TOKEN: "control-token", DISCORD_GUILD_ID: "367741339393327104", DISCORD_VOICE_TOKENS: tokens, BRIDGE_STATE_DIR: dir });
  const lines: string[] = [];
  const logger = new Logger("debug", function(line: string) { lines.push(line); });
  return { instance: new VoiceReflection(config, "server", logger), lines };
}

test("a human joining voice with an empty pool logs no free identity and stays degraded", async function() {
  const { instance, lines } = reflection("");
  await instance.start();
  await instance.ingest(voiceEvent("voice.join", { userId: "111111111111111111", guildId: "367741339393327104", channelId: "1070605940530880562", bot: false }, 1));
  await new Promise<void>(function(resolve) { setTimeout(resolve, 50); });
  assert.ok(lines.some(function(line) { return line.includes("voice pool has no free identity"); }));
  assert.equal(instance.readiness().voiceReflectionComplete, false);
  await instance.stop();
});

test("bot voice states and other guilds are ignored", async function() {
  const { instance, lines } = reflection("");
  await instance.start();
  await instance.ingest(voiceEvent("voice.join", { userId: "222222222222222222", guildId: "367741339393327104", channelId: "1070605940530880562", bot: true }, 2));
  await instance.ingest(voiceEvent("voice.join", { userId: "333333333333333333", guildId: "999999999999999999", channelId: "1070605940530880562", bot: false }, 3));
  await new Promise<void>(function(resolve) { setTimeout(resolve, 50); });
  assert.ok(!lines.some(function(line) { return line.includes("voice pool has no free identity") || line.includes("voice bot"); }));
  await instance.stop();
});

test("a probed pool skips invalid and duplicate voice tokens", async function() {
  const { DiscordVoicePool } = await import("../../src/voice/discord.js");
  const dir = mkdtempSync(join(tmpdir(), "zdb-probe-"));
  const config = loadConfig({ DISCORD_TOKEN: "control-token", DISCORD_GUILD_ID: "367741339393327104", DISCORD_VOICE_TOKENS: "bad-token,good-token,same-bot-token", BRIDGE_STATE_DIR: dir });
  const original = globalThis.fetch;
  globalThis.fetch = (async function(_url: unknown, init: { headers: { Authorization: string } }) {
    const token = init.headers.Authorization.replace("Bot ", "");
    if (token === "bad-token") return new Response("{}", { status: 401 });
    return new Response(JSON.stringify({ id: "371753800874065920" }), { status: 200 });
  }) as typeof fetch;
  try {
    const pool = new DiscordVoicePool(config);
    const result = await pool.probe();
    assert.deepEqual(result, { usable: 1, invalid: 1, duplicate: 1 });
    assert.equal(pool.usableCount(), 1);
    assert.equal(pool.invalidIdentityCount(), 2);
  } finally { globalThis.fetch = original; }
});

test("a stale non-snowflake voice channel never reaches the pool", async function() {
  const { instance, lines } = reflection("token-a");
  await instance.start();
  await instance.ingest(voiceEvent("voice.join", { userId: "zellous:" + "a".repeat(64), guildId: "367741339393327104", channelId: "discord-room-1283057471031738379", bot: false }, 9));
  await new Promise<void>(function(resolve) { setTimeout(resolve, 50); });
  assert.ok(lines.some(function(line) { return line.includes("voice channel is not a Discord snowflake"); }));
  assert.ok(!lines.some(function(line) { return line.includes("voice bot join failed"); }));
  await instance.stop();
});
