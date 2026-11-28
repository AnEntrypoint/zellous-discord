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
  channelId: string;
  humanUserIds: Set<string>;
}

export interface VoiceJoinResult {
  identity: string;
  botUserId: string;
  channelId: string;
  moved: boolean;
  shared: boolean;
}

export class DiscordVoicePool {
  private readonly sessions = new Map<string, DiscordVoiceSession>();
  private readonly clients = new Map<number, Client>();

  constructor(private readonly config: Config) {}

  capacity(): number {
    return this.config.voiceTokens.length;
  }

  private async clientFor(index: number): Promise<Client> {
    const existing = this.clients.get(index);
    if (existing) return existing;
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
    await client.login(this.config.voiceTokens[index].reveal());
    this.clients.set(index, client);
    return client;
  }

  private sessionFor(humanUserId: string): DiscordVoiceSession | undefined {
    for (const session of this.sessions.values()) if (session.humanUserIds.has(humanUserId)) return session;
    return undefined;
  }

  private sessionIn(channelId: string): DiscordVoiceSession | undefined {
    for (const session of this.sessions.values()) if (session.channelId === channelId) return session;
    return undefined;
  }

  private freeIndex(): number {
    for (let index = 0; index < this.config.voiceTokens.length; index += 1) if (!this.sessions.has("voice-bot-" + String(index + 1))) return index;
    return -1;
  }

  async join(guildId: string, channelId: string, humanUserId: string, onFrame: (identity: string, frame: VoiceFrame) => void): Promise<VoiceJoinResult | null> {
    const current = this.sessionFor(humanUserId);
    if (current && current.channelId === channelId) return { identity: current.identity, botUserId: current.userId, channelId, moved: false, shared: current.humanUserIds.size > 1 };
    if (current) this.leave(humanUserId);
    const shared = this.sessionIn(channelId);
    if (shared) {
      shared.humanUserIds.add(humanUserId);
      this.subscribe(shared.identity, humanUserId, function(frame: VoiceFrame) { onFrame(shared.identity, frame); });
      return { identity: shared.identity, botUserId: shared.userId, channelId, moved: Boolean(current), shared: shared.humanUserIds.size > 1 };
    }
    const index = this.freeIndex();
    if (index < 0) return null;
    const identity = "voice-bot-" + String(index + 1);
    const client = await this.clientFor(index);
    const guild = await client.guilds.fetch(guildId);
    const connection = joinVoiceChannel({ channelId, guildId, adapterCreator: guild.voiceAdapterCreator, selfMute: false, selfDeaf: false });
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
    const stream = new PassThrough();
    const player = createAudioPlayer();
    player.play(createAudioResource(stream, { inputType: StreamType.Opus }));
    connection.subscribe(player);
    const session: DiscordVoiceSession = { client, connection, player, stream, userId: String(client.user?.id ?? ""), identity, channelId, humanUserIds: new Set([humanUserId]) };
    this.sessions.set(identity, session);
    this.subscribe(identity, humanUserId, function(frame: VoiceFrame) { onFrame(identity, frame); });
    return { identity, botUserId: session.userId, channelId, moved: Boolean(current), shared: false };
  }

  async start(guildId: string, channelId: string): Promise<void> {
    for (let index = 0; index < this.config.voiceTokens.length; index += 1) {
      const identity = "voice-bot-" + String(index + 1);
      const client = await this.clientFor(index);
      const guild = await client.guilds.fetch(guildId);
      const connection = joinVoiceChannel({ channelId, guildId, adapterCreator: guild.voiceAdapterCreator, selfMute: false, selfDeaf: false });
      await entersState(connection, VoiceConnectionStatus.Ready, 10000);
      const stream = new PassThrough();
      const player = createAudioPlayer();
      player.play(createAudioResource(stream, { inputType: StreamType.Opus }));
      connection.subscribe(player);
      this.sessions.set(identity, { client, connection, player, stream, userId: String(client.user?.id ?? ""), identity, channelId, humanUserIds: new Set<string>() });
    }
  }

  leave(humanUserId: string): string | null {
    const session = this.sessionFor(humanUserId);
    if (!session) return null;
    session.humanUserIds.delete(humanUserId);
    if (session.humanUserIds.size > 0) return null;
    session.stream.end();
    session.connection.destroy();
    this.sessions.delete(session.identity);
    return session.identity;
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

  boundIdentities(): Array<{ identity: string; botUserId: string; channelId: string; humanUserIds: string[] }> {
    return Array.from(this.sessions.values()).map((session) => ({ identity: session.identity, botUserId: session.userId, channelId: session.channelId, humanUserIds: [...session.humanUserIds] }));
  }

  async close(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.stream.end();
      session.connection.destroy();
    }
    this.sessions.clear();
    for (const client of this.clients.values()) client.destroy();
    this.clients.clear();
  }
}
