import { join } from "node:path";
import { loadConfigFromEnvFile } from "./config.js";
import { Logger } from "./logger.js";
import { Ledger } from "./ledger.js";
import { MappingStore } from "./mapping.js";
import { SyncEngine } from "./sync/engine.js";
import { MockAdapter } from "./adapters/mock.js";
import { degradedFeatures, DiscordAdapter, gatewayIntents } from "./adapters/discord.js";
import { NostrAdapter } from "./adapters/nostr.js";
import { HealthServer } from "./health.js";
import { Metrics } from "./observability.js";
import { ownerHex, resolveServerId } from "./identity.js";
import { BridgeEchoStore } from "./sync/echo.js";
import { VoiceReflection } from "./voice/reflection.js";
import { emptyVoiceProof, voiceReadiness } from "./voice/readiness.js";
import type { BridgeAdapter } from "./types.js";
import type { Config } from "./config.js";

export class BridgeService {
  private readonly metrics = new Metrics();
  private logger: Logger | null = null;
  private engine: SyncEngine | null = null;
  private health: HealthServer | null = null;
  private discord: BridgeAdapter | null = null;
  private zellous: BridgeAdapter | null = null;
  private ledger: Ledger | null = null;
  private config: Config | null = null;
  private echo: BridgeEchoStore | null = null;
  private voice: VoiceReflection | null = null;
  private stopping = false;

  async start(): Promise<void> {
    const config = loadConfigFromEnvFile();
    this.config = config;
    if (!process.env.ZDBRIDGE_READ_ONLY) process.env.ZDBRIDGE_READ_ONLY = config.liveInventoryMode === "reconcile" ? "0" : "1";
    this.logger = new Logger(config.logLevel);
    const owner = ownerHex(config);
    const serverId = resolveServerId(config, owner);
    const resolvedConfig = { ...config, zellousServerId: serverId };
    this.ledger = new Ledger(join(config.bridgeStateDir, "bridge-ledger.jsonl"));
    const mapping = new MappingStore(this.ledger);
    this.echo = new BridgeEchoStore(config.bridgeStateDir);
    this.voice = new VoiceReflection(resolvedConfig, serverId, this.logger);
    await this.voice.start();
    if (process.env.ZDBRIDGE_MOCK === "1") {
      this.discord = new MockAdapter("discord", serverId, config.discordGuildId);
      this.zellous = new MockAdapter("zellous", serverId, config.discordGuildId);
    } else {
      this.discord = new DiscordAdapter(resolvedConfig, this.logger, mapping, this.echo!);
      this.zellous = new NostrAdapter(resolvedConfig, serverId, this.logger, mapping, this.echo!);
    }
    this.engine = new SyncEngine(this.discord, this.zellous, this.ledger, mapping, this.logger, this.voice!);
    await this.engine.start();
    this.metrics.set("service.started", 1);
    this.health = new HealthServer(config.healthPort, this.metrics, () => this.snapshot());
    await this.health.start();
    const shutdown = () => { void this.stop(); };
    process.once("SIGTERM", shutdown);
    process.once("SIGINT", shutdown);
    this.logger.info("bridge service started", { guildId: config.discordGuildId, serverId, owner, mock: process.env.ZDBRIDGE_MOCK === "1" });
  }

  async stop(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    if (this.health) await this.health.stop();
    if (this.engine) await this.engine.stop();
    if (this.discord) await this.discord.close();
    if (this.zellous) await this.zellous.close();
    if (this.voice) await this.voice.stop();
    this.metrics.set("service.started", 0);
    this.logger?.info("bridge service stopped");
  }

  async restart(): Promise<void> {
    await this.stop();
    this.stopping = false;
    await this.start();
  }

  snapshot(): Record<string, unknown> {
    const state = this.ledger?.getState();
    const readiness = this.config ? (this.voice ? this.voice.readiness() : voiceReadiness(this.config, emptyVoiceProof())) : null;
    const features = this.config ? degradedFeatures(this.config, readiness ?? undefined) : ["uninitialized"];
    return {
      status: this.stopping ? "stopping" : features.length > 0 ? "degraded" : "ok",
      ownerHex: this.config ? ownerHex(this.config) : null,
      serverId: this.config ? resolveServerId(this.config) : null,
      privilegedIntentsEnabled: this.config?.privilegedIntentsEnabled ?? false,
      gatewayIntents: this.config ? gatewayIntents(this.config).map(String) : [],
      degradedFeatures: features,
      voiceTokenCount: readiness?.voiceTokenCount ?? 0,
      voicePoolState: readiness?.voicePoolState ?? "absent",
      voiceReflectionComplete: readiness?.voiceReflectionComplete ?? false,
      voiceReadinessReason: readiness?.reason ?? "UNINITIALIZED",
      voiceIdentityCount: readiness?.identityCount ?? 0,
      voiceFrameCount: readiness?.frameCount ?? 0,
      rooms: state?.rooms.size ?? 0,
      messages: state?.messages.size ?? 0,
      suppressions: state?.suppressions.size ?? 0,
      checkpoints: Object.fromEntries(state?.checkpoints.entries() ?? []),
      metrics: this.metrics.snapshot()
    };
  }
}