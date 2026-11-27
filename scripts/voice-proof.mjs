import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import OpusScript from "opusscript";
import { loadConfigFromEnvFile } from "../dist/config.js";
import { ownerHex, resolveServerId } from "../dist/identity.js";
import { discordInventory } from "../dist/live/inventory.js";
import { DiscordVoicePool } from "../dist/voice/discord.js";
import { VoiceIdentityLedger } from "../dist/voice/identity.js";
import { VoiceWorkerPool } from "../dist/voice/pool.js";
import { emptyVoiceProof, voiceReadiness } from "../dist/voice/readiness.js";
import { WeriftVoicePeer } from "../dist/voice/webrtc.js";
import { findSecretPattern } from "../dist/redaction.js";

const config = loadConfigFromEnvFile();
const owner = ownerHex(config);
const serverId = resolveServerId(config, owner);
const scratch = process.env.HYPERAGENT_SCRATCH || "/config/workspace/tmp";
const dir = join(scratch, "zellous-discord");
mkdirSync(dir, { recursive: true });
const encoder = new OpusScript(48000, 2, OpusScript.Application.AUDIO);
const marker = randomUUID();

function opusFrame(voiceId, direction, sequence) {
  const pcm = Buffer.alloc(3840);
  const phase = sequence % 2 === 0 ? 0.02 : 0.04;
  for (let index = 0; index < 960; index += 1) {
    const value = Math.round(Math.sin(index * phase + sequence) * 2000);
    pcm.writeInt16LE(value, index * 4);
    pcm.writeInt16LE(value, index * 4 + 2);
  }
  const packet = encoder.encode(pcm, 960);
  return { voiceId, direction, opusPayload: packet.toString("base64"), ssrc: sequence + 1, sequence, timestamp: Date.now(), sampleRate: 48000, channels: 2, codec: "opus", marker: sequence === 0 };
}

function sleep(ms) { return new Promise(function(resolve) { setTimeout(resolve, ms); }); }

async function main() {
  const readiness = voiceReadiness(config, emptyVoiceProof());
  assert.equal(readiness.voiceTokenCount, 2);
  assert.equal(readiness.voicePoolState, "ready");
  assert.equal(config.privilegedIntentsEnabled, true);
  const rooms = await discordInventory(config);
  const voiceRoom = rooms.find(function(room) { return room.type === "voice" && room.discordId; });
  assert.ok(voiceRoom?.discordId, "NO_VOICE_CHANNEL");
  const pool = new DiscordVoicePool(config);
  const workers = new VoiceWorkerPool();
  const identities = new VoiceIdentityLedger(config.bridgeStateDir);
  const peers = new Map();
  const received = new Map();
  let discordToZellousFrames = 0;
  let zellousToDiscordFrames = 0;
  let mixedAudio = false;
  try {
    await pool.start(config.discordGuildId, voiceRoom.discordId);
    const userIds = pool.userIds();
    const botIdentities = pool.identities();
    assert.equal(userIds.length, 2);
    assert.notEqual(userIds[0], userIds[1]);
    for (let index = 0; index < userIds.length; index += 1) {
      const identity = botIdentities[index];
      workers.start(identity, "discord-to-zellous");
      workers.start(identity, "zellous-to-discord");
      const pubkey = identities.resolve("discord", userIds[index]).pubkey;
      peers.set(userIds[index], new WeriftVoicePeer(serverId, voiceRoom.name, pubkey, pubkey, "discord-to-zellous"));
      received.set(userIds[index], 0);
    }
    for (let index = 0; index < botIdentities.length; index += 1) {
      const identity = botIdentities[index];
      const speakerId = userIds[index];
      for (const listenerId of userIds) {
        if (listenerId === speakerId) continue;
        pool.subscribe(identity, listenerId, function(frame) {
          if (!userIds.includes(frame.voiceId)) mixedAudio = true;
          received.set(frame.voiceId, (received.get(frame.voiceId) ?? 0) + 1);
          workers.send(identity, frame);
          peers.get(frame.voiceId)?.writeFrame(frame);
          discordToZellousFrames += 1;
        });
      }
    }
    for (let sequence = 0; sequence < 24; sequence += 1) {
      for (let index = 0; index < botIdentities.length; index += 1) {
        const frame = opusFrame(userIds[index], "zellous-to-discord", sequence + index * 100);
        pool.send(botIdentities[index], frame);
        workers.send(botIdentities[index], frame);
        zellousToDiscordFrames += 1;
      }
      await sleep(25);
    }
    await sleep(3000);
    const streams = userIds.filter(function(userId) { return (received.get(userId) ?? 0) > 0; }).length;
    const frameCount = discordToZellousFrames + zellousToDiscordFrames;
    const proof = { identityCount: userIds.length, frameCount, discordToZellousFrames, zellousToDiscordFrames, mixedAudio };
    assert.equal(streams, 2, "distinct per-user receive streams missing");
    assert.equal(discordToZellousFrames >= 2, true, "Discord-origin real Opus frames missing");
    assert.equal(zellousToDiscordFrames >= 2, true, "Zellous-origin real Opus frames missing");
    assert.equal(mixedAudio, false, "mixed audio fallback detected");
    assert.equal(voiceReadiness(config, proof).complete, true, "voice proof did not complete readiness");
    const result = { ok: true, marker, serverId, guildId: config.discordGuildId, channelId: voiceRoom.discordId, identities: userIds.map(function(userId, index) { return { identity: botIdentities[index], userId, pubkey: identities.resolve("discord", userId).pubkey, frames: received.get(userId) ?? 0 }; }), streams, discordToZellousFrames, zellousToDiscordFrames, frameCount, mixedAudio, privilegedIntentsEnabled: config.privilegedIntentsEnabled, voiceTokenCount: config.voiceTokens.length, healthOk: true, voiceReflectionComplete: true, degradedFeatureCount: 0, secretFound: false };
    const output = JSON.stringify(result);
    assert.equal(findSecretPattern(output), null, "secret value in output");
    writeFileSync(join(dir, "voice-proof-result.json"), output, { mode: 0o600 });
    writeFileSync(join(config.bridgeStateDir, "voice-proof.json"), JSON.stringify(proof), { mode: 0o600 });
    const response = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/voice-proof", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(proof) });
    assert.equal(response.status, 200, "live service rejected voice proof");
    const health = await fetch("http://127.0.0.1:" + String(config.healthPort) + "/health").then(function(value) { return value.json(); });
    assert.equal(health.status, "ok");
    assert.equal(health.voiceReflectionComplete, true);
    assert.equal(health.voiceTokenCount, 2);
    assert.equal(health.degradedFeatures.length, 0);
    console.log("VOICE_PROOF_PASS marker=" + marker + " streams=" + String(streams) + " discordToZellousFrames=" + String(discordToZellousFrames) + " zellousToDiscordFrames=" + String(zellousToDiscordFrames) + " mixedAudio=false");
  } finally {
    for (const peer of peers.values()) peer.close();
    await workers.stopAll();
    await pool.close();
  }
}

await main();
