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
  private readonly proofPath: string;

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger) {
    this.discordPool = new DiscordVoicePool(config);
    this.identities = new VoiceIdentityLedger(config.bridgeStateDir);
    this.proofPath = join(config.bridgeStateDir, "voice-proof.json");
    this.loadProof();
  }

  async start(): Promise<void> {
    this.started = true;
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

  loadProof(): void {
    this.proof = emptyVoiceProof();
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
