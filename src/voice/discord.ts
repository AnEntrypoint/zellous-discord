import { PassThrough } from "node:stream";
import { EndBehaviorType, StreamType, VoiceConnectionStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import type { Config } from "../config.js";
import type { VoiceFrame } from "../types.js";

interface DiscordVoiceSession {
  client: Client;
  connection: any;
  player: any;
  stream: PassThrough;
  userId: string;
  identity: string;
}

export class DiscordVoicePool {
  private readonly sessions = new Map<string, DiscordVoiceSession>();

  constructor(private readonly config: Config) {}

  capacity(): number {
    return this.config.voiceTokens.length;
  }

  async start(guildId: string, channelId: string): Promise<void> {
    for (let index = 0; index < this.config.voiceTokens.length; index += 1) {
      const identity = "voice-bot-" + String(index + 1);
      const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
      await client.login(this.config.voiceTokens[index].reveal());
      const guild = await client.guilds.fetch(guildId);
      const connection = joinVoiceChannel({
        channelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator,
        selfMute: false,
        selfDeaf: false
      });
      await entersState(connection, VoiceConnectionStatus.Ready, 10000);
      const stream = new PassThrough();
      const resource = createAudioResource(stream, { inputType: StreamType.Opus });
      const player = createAudioPlayer();
      player.play(resource);
      connection.subscribe(player);
      this.sessions.set(identity, { client, connection, player, stream, userId: String(client.user?.id ?? ""), identity });
    }
  }

  subscribe(identity: string, userId: string, onFrame: (frame: VoiceFrame) => void): void {
    const session = this.sessions.get(identity);
    if (!session) return;
    const opus = session.connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 100 } });
    opus.on("data", (packet: Buffer) => {
      onFrame({
        voiceId: userId,
        direction: "discord-to-zellous",
        opusPayload: packet.toString("base64"),
        ssrc: 0,
        sequence: 0,
        timestamp: Date.now(),
        sampleRate: 48000,
        channels: 2,
        codec: "opus",
        marker: false
      });
    });
  }

  send(identity: string, frame: VoiceFrame): void {
    const session = this.sessions.get(identity);
    if (!session) return;
    session.stream.write(Buffer.from(frame.opusPayload, "base64"));
  }

  userIds(): string[] {
    return Array.from(this.sessions.values()).map((session) => session.userId);
  }

  identities(): string[] {
    return Array.from(this.sessions.keys());
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.stream.end();
      session.connection.destroy();
      session.client.destroy();
    }
    this.sessions.clear();
  }
}