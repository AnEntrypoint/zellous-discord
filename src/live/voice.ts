import type { Config } from "../config.js";
import { Logger } from "../logger.js";
import { discordInventory } from "./inventory.js";
import { DiscordVoicePool } from "../voice/discord.js";
import { VoiceIdentityLedger } from "../voice/identity.js";
import { emptyVoiceProof, voiceReadiness } from "../voice/readiness.js";
import type { VoiceFrame } from "../types.js";

export interface VoiceSmokeResult {
  ok: boolean;
  degraded: boolean;
  reason: string | null;
  guildId: string;
  channelId: string;
  poolCapacity: number;
  identities: Array<{ identity: string; userId: string; pubkey: string; frames: number }>;
  streams: number;
  closed: boolean;
}

function syntheticFrame(voiceId: string, direction: "discord-to-zellous" | "zellous-to-discord", marker: number): VoiceFrame {
  const payload = Buffer.from("synthetic-opus-frame-" + String(marker) + "-" + voiceId).toString("base64");
  return { voiceId, direction, opusPayload: payload, ssrc: marker, sequence: marker, timestamp: Date.now(), sampleRate: 48000, channels: 2, codec: "opus", marker: marker === 0 };
}

export async function voiceSmoke(config: Config): Promise<VoiceSmokeResult> {
  const readiness = voiceReadiness(config, emptyVoiceProof());
  if (readiness.degraded) {
    return { ok: true, degraded: true, reason: readiness.reason, guildId: config.discordGuildId, channelId: "", poolCapacity: config.voiceTokens.length, identities: [], streams: 0, closed: true };
  }
  const rooms = await discordInventory(config);
  const voiceRoom = rooms.find((room) => room.type === "voice" && room.discordId);
  if (!voiceRoom?.discordId) throw new Error("NO_VOICE_CHANNEL: guild has no voice channel");
  const logger = new Logger("error", () => {});
  const identities = new VoiceIdentityLedger(config.bridgeStateDir);
  const pool = new DiscordVoicePool(config);
  let streams = 0;
  try {
    await pool.start(config.discordGuildId, voiceRoom.discordId);
    const userIds = pool.userIds();
    const botIdentities = pool.identities();
    for (let index = 0; index < botIdentities.length; index += 1) {
      for (const userId of userIds) {
        if (userId === userIds[index]) continue;
        pool.subscribe(botIdentities[index], userId, () => { streams += 1; });
      }
      pool.send(botIdentities[index], syntheticFrame(userIds[index], "zellous-to-discord", index));
      pool.send(botIdentities[index], syntheticFrame(userIds[index], "discord-to-zellous", index + 10));
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 1500));
    return {
      ok: streams > 0,
      degraded: false,
      reason: null,
      guildId: config.discordGuildId,
      channelId: voiceRoom.discordId,
      poolCapacity: pool.capacity(),
      identities: botIdentities.map((identity, index) => ({ identity, userId: userIds[index], pubkey: identities.resolve("discord", userIds[index]).pubkey, frames: 2 })),
      streams,
      closed: false
    };
  } finally {
    await pool.close();
  }
}