import test from "node:test";
import assert from "node:assert/strict";
import { VoiceWorkerPool } from "../../src/voice/pool.js";
import type { VoiceFrame } from "../../src/types.js";

function frame(voiceId: string, direction: "discord-to-zellous" | "zellous-to-discord", marker: number): VoiceFrame {
  return { voiceId, direction, opusPayload: Buffer.from("opus-" + voiceId + "-" + String(marker)).toString("base64"), ssrc: marker, sequence: marker, timestamp: marker, sampleRate: 48000, channels: 2, codec: "opus", marker: marker === 0 };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test("synthetic loopback keeps distinct speaker identities and never mixes audio", async () => {
  const pool = new VoiceWorkerPool();
  const identities = [
    ["discord-user-1", "discord-to-zellous"],
    ["discord-user-2", "discord-to-zellous"],
    ["zellous-user-1", "zellous-to-discord"],
    ["zellous-user-2", "zellous-to-discord"]
  ] as const;
  try {
    for (const [identity, direction] of identities) pool.start(identity, direction);
    for (const [identity, direction] of identities) {
      pool.send(identity, frame(identity, direction, 0));
      pool.send(identity, frame(identity, direction, 1));
    }
    await wait(120);
    assert.equal(pool.workerCount(), 4);
    assert.equal(pool.routedFrames().length, 8);
    for (const [identity] of identities) {
      const frames = pool.frames(identity);
      assert.equal(frames.length, 2);
      assert.ok(frames.every((entry) => entry.voiceId === identity));
    }
    pool.mute("discord-user-1", true);
    pool.leave("discord-user-2");
    pool.send("discord-user-1", frame("discord-user-1", "discord-to-zellous", 2));
    pool.send("discord-user-2", frame("discord-user-2", "discord-to-zellous", 2));
    pool.send("zellous-user-1", frame("zellous-user-1", "zellous-to-discord", 2));
    await wait(120);
    assert.equal(pool.frames("discord-user-1").length, 2);
    assert.equal(pool.frames("discord-user-2").length, 2);
    assert.equal(pool.frames("zellous-user-1").length, 3);
    assert.equal(pool.state("discord-user-2")?.leave, true);
    assert.equal(pool.state("zellous-user-1")?.muted, false);
  } finally {
    await pool.stopAll();
  }
});