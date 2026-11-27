import type { Config } from "../config.js";
import type { Logger } from "../logger.js";
import type { CanonicalEvent, VoiceFrame } from "../types.js";
import { DiscordVoicePool } from "./discord.js";
import { VoiceIdentityLedger } from "./identity.js";
import { VoiceWorkerPool } from "./pool.js";
import { emptyVoiceProof, voiceReadiness, type VoiceProof } from "./readiness.js";
import { WeriftVoicePeer } from "./webrtc.js";

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

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger) {
    this.discordPool = new DiscordVoicePool(config);
    this.identities = new VoiceIdentityLedger(config.bridgeStateDir);
  }

  async start(): Promise<void> {
    if (this.config.voiceTokens.length < 2) return;
    const response = await fetch("https://discord.com/api/v10/guilds/" + this.config.discordGuildId + "/channels", { headers: { Authorization: "Bot " + this.config.discordToken.reveal() }, signal: AbortSignal.timeout(10000) });
    const channels = await response.json() as Array<{ id: string; type: number; name: string }>;
    const voiceChannel = channels.find(function(channel) { return channel.type === 2; });
    if (!voiceChannel) throw new Error("NO_VOICE_CHANNEL");
    await this.discordPool.start(this.config.discordGuildId, voiceChannel.id);
    const botIdentities = this.discordPool.identities();
    const userIds = this.discordPool.userIds();
    for (const identity of botIdentities) {
      this.workers.start(identity, "discord-to-zellous");
      this.workers.start(identity, "zellous-to-discord");
    }
    for (let index = 0; index < botIdentities.length; index += 1) {
      const identity = botIdentities[index];
      const userId = userIds[index];
      const local = this.identities.resolve("discord", userId);
      const peer = new WeriftVoicePeer(this.serverId, voiceChannel.name, local.pubkey, local.pubkey, "discord-to-zellous");
      this.peers.set(userId, peer);
      for (const speakerId of userIds) {
        if (speakerId === userId) continue;
        this.discordPool.subscribe(identity, speakerId, (frame) => this.acceptDiscordFrame(identity, frame));
      }
    }
    this.proof = { ...this.proof, identityCount: userIds.length };
    this.started = true;
    this.logger.info("voice reflection started", { identities: userIds.length, channelId: voiceChannel.id });
  }

  async ingest(event: CanonicalEvent): Promise<void> {
    if (!event.operation.startsWith("voice.")) return;
    if (!this.started) return;
    const frame = frameFromVoiceEvent(event);
    if (!frame) return;
    if (frame.direction === "zellous-to-discord") this.acceptZellousFrame(frame);
  }

  private acceptDiscordFrame(identity: string, frame: VoiceFrame): void {
    this.workers.send(identity, frame);
    const peer = this.peers.get(frame.voiceId);
    if (peer) peer.writeFrame(frame);
    this.proof = { ...this.proof, frameCount: this.proof.frameCount + 1, discordToZellousFrames: this.proof.discordToZellousFrames + 1 };
  }

  private acceptZellousFrame(frame: VoiceFrame): void {
    const identity = this.discordPool.identities()[0];
    if (!identity) return;
    this.workers.send(identity, frame);
    this.discordPool.send(identity, frame);
    this.proof = { ...this.proof, frameCount: this.proof.frameCount + 1, zellousToDiscordFrames: this.proof.zellousToDiscordFrames + 1 };
  }

  readiness() {
    return voiceReadiness(this.config, this.proof);
  }

  proofState(): VoiceProof {
    return { ...this.proof };
  }

  async stop(): Promise<void> {
    await this.discordPool.close();
    await this.workers.stopAll();
    for (const peer of this.peers.values()) peer.close();
    this.peers.clear();
    this.started = false;
  }
}
