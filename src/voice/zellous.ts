import type { Config } from "../config.js";
import { deriveSecretKey, loadOrCreateSeed, publicKeyHex } from "../identity.js";
import type { Logger } from "../logger.js";
import { createNodeWireweave } from "../wireweave-node.js";

export function voiceBridgeKey(config: Config): Uint8Array {
  return deriveSecretKey(loadOrCreateSeed(config.bridgeStateDir), "zellous-voice-bridge");
}

export function voiceBridgePubkey(config: Config): string {
  return publicKeyHex(voiceBridgeKey(config));
}

export interface ZellousVoiceState {
  channel: string | null;
  connected: boolean;
  pubkey: string;
  relays: number;
}

export class ZellousVoiceBridge {
  private ww: any = null;
  private channel: string | null = null;
  private chain: Promise<void> = Promise.resolve();

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger) {}

  private session(): any {
    if (!this.ww) {
      this.ww = createNodeWireweave(this.config, { secretKey: voiceBridgeKey(this.config), stateSubdir: "voice-bridge", relays: this.config.nostrRelays });
    }
    return this.ww.ensureVoice({ serverId: this.serverId, displayName: "Discord bridge", onAudioTrack: null, onVideoTrack: null });
  }

  join(channelName: string): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (this.channel === channelName) return;
      if (this.channel) { this.logger.warn("zellous voice bridge already serves another channel", { active: this.channel, requested: channelName }); return; }
      await this.session().connect(channelName, { displayName: "Discord bridge" });
      this.channel = channelName;
      this.logger.info("zellous voice bridge joined", { channel: channelName, pubkey: voiceBridgePubkey(this.config) });
    }).catch((error: unknown) => { this.logger.error("zellous voice bridge join failed", { channel: channelName, message: error instanceof Error ? error.message : String(error) }); });
    return this.chain;
  }

  leave(channelName: string): Promise<void> {
    this.chain = this.chain.then(async () => {
      if (this.channel !== channelName) return;
      await this.ww.voice.disconnect();
      this.channel = null;
      this.logger.info("zellous voice bridge left", { channel: channelName });
    }).catch((error: unknown) => { this.logger.error("zellous voice bridge leave failed", { channel: channelName, message: error instanceof Error ? error.message : String(error) }); });
    return this.chain;
  }

  state(): ZellousVoiceState {
    return { channel: this.channel, connected: this.channel !== null, pubkey: voiceBridgePubkey(this.config), relays: this.config.nostrRelays.length };
  }

  async close(): Promise<void> {
    if (this.channel) await this.leave(this.channel);
    if (this.ww) this.ww.pool.disconnect();
    this.ww = null;
  }
}
