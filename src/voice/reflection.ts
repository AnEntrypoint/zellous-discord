import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../config.js";
import type { Logger } from "../logger.js";
import type { CanonicalEvent, VoiceFrame } from "../types.js";
import { DiscordVoicePool } from "./discord.js";
import { VoiceIdentityLedger } from "./identity.js";
import { VoiceWorkerPool } from "./pool.js";
import { emptyVoiceProof, voiceReadiness, type VoiceProof } from "./readiness.js";
import { WeriftVoicePeer } from "./webrtc.js";
import { ZellousVoiceBridge } from "./zellous.js";

function frameFromVoiceEvent(event: CanonicalEvent): VoiceFrame | null {
  const voice = event.payload.voice as { opusPayload?: string; identity?: string; userId?: string; direction?: string } | undefined;
  if (!voice?.opusPayload) return null;
  const direction = voice.direction === "zellous-to-discord" ? "zellous-to-discord" : "discord-to-zellous";
  return { voiceId: String(voice.userId ?? voice.identity ?? event.sourceId), direction, opusPayload: voice.opusPayload, ssrc: 0, sequence: 0, timestamp: event.occurredAt, sampleRate: 48000, channels: 2, codec: "opus", marker: false };
}

export class VoiceReflection {
  private readonly discordPool: DiscordVoicePool;
  private readonly workers = new VoiceWorkerPool();
  private readonly peers = new Map<string, WeriftVoicePeer>();
  private readonly identities: VoiceIdentityLedger;
  private proof: VoiceProof = emptyVoiceProof();
  private started = false;
  private readonly zellousBridge: ZellousVoiceBridge;
  private readonly discordHumans = new Map<string, Set<string>>();
  private readonly chains = new Map<string, Promise<void>>();
  private readonly proofPath: string;

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger, private readonly channelName: (discordId: string) => string | null = () => null) {
    this.discordPool = new DiscordVoicePool(config);
    this.zellousBridge = new ZellousVoiceBridge(config, serverId, logger);
    this.identities = new VoiceIdentityLedger(config.bridgeStateDir);
    this.proofPath = join(config.bridgeStateDir, "voice-proof.json");
    this.loadProof();
  }

  async start(): Promise<void> {
    this.started = true;
    try {
      const probed = await this.discordPool.probe();
      this.logger.info("voice token probe", { usable: probed.usable, invalid: probed.invalid, duplicate: probed.duplicate });
    } catch (error) { this.logger.warn("voice token probe failed", { message: error instanceof Error ? error.message : String(error) }); }
  }

  async ingest(event: CanonicalEvent): Promise<void> {
    if (!event.operation.startsWith("voice.")) return;
    if (!this.started) return;
    if ((event.source === "discord" || event.source === "zellous") && (event.operation === "voice.join" || event.operation === "voice.leave")) {
      this.followHuman(event);
      return;
    }
    const frame = frameFromVoiceEvent(event);
    if (!frame) return;
    if (frame.direction === "zellous-to-discord") this.acceptZellousFrame(frame);
  }

  private followHuman(event: CanonicalEvent): void {
    const voice = event.payload.voice as { userId?: string; channelId?: string | null; bot?: boolean; guildId?: string } | undefined;
    const userId = String(voice?.userId ?? event.sourceId);
    if (!userId || voice?.bot === true) return;
    if (voice?.guildId && voice.guildId !== this.config.discordGuildId) return;
    const previous = this.chains.get(userId) ?? Promise.resolve();
    const next = previous.then(async () => {
      if (event.operation === "voice.leave" || !voice?.channelId) {
        const identity = this.discordPool.leave(userId);
        if (identity) this.logger.info("voice bot left channel", { identity, humanUserId: userId });
        this.refreshIdentityCount();
        if (event.source === "discord") await this.releaseDiscordHuman(userId);
        return;
      }
      if (!/^[0-9]{17,20}$/.test(voice.channelId)) {
        this.logger.warn("voice channel is not a Discord snowflake", { channelId: voice.channelId, humanUserId: userId });
        return;
      }
      if (event.source === "discord") await this.holdDiscordHuman(userId, voice.channelId);
      const joined = await this.discordPool.join(this.config.discordGuildId, voice.channelId, userId, (identity, frame) => this.acceptDiscordFrame(identity, frame));
      if (!joined) {
        this.logger.warn("voice pool has no free identity", { humanUserId: userId, capacity: this.discordPool.capacity() });
        return;
      }
      this.logger.info("voice bot joined channel", { identity: joined.identity, botUserId: joined.botUserId, channelId: joined.channelId, humanUserId: userId, moved: joined.moved, shared: joined.shared });
      this.refreshIdentityCount();
      if (joined.shared) this.proof = { ...this.proof, mixedAudio: true };
    }).catch((error: unknown) => {
      this.logger.error("voice bot join failed", { humanUserId: userId, message: error instanceof Error ? error.message : String(error) });
    });
    this.chains.set(userId, next);
  }

  private async holdDiscordHuman(userId: string, channelId: string): Promise<void> {
    await this.releaseDiscordHuman(userId);
    const set = this.discordHumans.get(channelId) ?? new Set<string>();
    set.add(userId);
    this.discordHumans.set(channelId, set);
    const name = this.channelName(channelId);
    if (name) await this.zellousBridge.join(name);
  }

  private async releaseDiscordHuman(userId: string): Promise<void> {
    for (const [channelId, set] of [...this.discordHumans.entries()]) {
      if (!set.delete(userId)) continue;
      if (set.size === 0) {
        this.discordHumans.delete(channelId);
        const name = this.channelName(channelId);
        if (name) await this.zellousBridge.leave(name);
      }
    }
  }

  zellousVoice() {
    return this.zellousBridge.state();
  }

  private refreshIdentityCount(): void {
    this.proof = { ...this.proof, identityCount: this.discordPool.identities().length };
  }

  private acceptDiscordFrame(identity: string, frame: VoiceFrame): void {
    this.workers.send(identity, frame);
    const peer = this.peers.get(frame.voiceId);
    if (!peer) return;
    peer.writeFrame(frame);
    this.proof = { ...this.proof, frameCount: this.proof.frameCount + 1, discordToZellousFrames: this.proof.discordToZellousFrames + 1 };
  }

  private acceptZellousFrame(frame: VoiceFrame): void {
    const identity = this.discordPool.identities()[0];
    if (!identity) return;
    this.workers.send(identity, frame);
    this.discordPool.send(identity, frame);
    this.proof = { ...this.proof, frameCount: this.proof.frameCount + 1, zellousToDiscordFrames: this.proof.zellousToDiscordFrames + 1 };
  }

  loadProof(): void {
    this.proof = emptyVoiceProof();
  }

  readiness() {
    return voiceReadiness(this.config, this.proof, this.discordPool.usableCount());
  }

  invalidIdentityCount(): number {
    return this.discordPool.invalidIdentityCount();
  }

  sessions(): Array<{ identity: string; botUserId: string; channelId: string; humanCount: number; discordHumanCount: number; zellousHumanCount: number }> {
    return this.discordPool.boundIdentities().map(function(session) { const discord = session.humanUserIds.filter(function(id) { return /^[0-9]{17,20}$/.test(id); }).length; return { identity: session.identity, botUserId: session.botUserId, channelId: session.channelId, humanCount: session.humanUserIds.length, discordHumanCount: discord, zellousHumanCount: session.humanUserIds.length - discord }; });
  }

  proofState(): VoiceProof {
    return { ...this.proof };
  }

  async stop(): Promise<void> {
    await this.zellousBridge.close();
    await this.discordPool.close();
    await this.workers.stopAll();
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
    this.started = false;
  }
}
