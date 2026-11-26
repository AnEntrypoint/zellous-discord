import { readFileSync } from "node:fs";
import { z } from "zod";
import type { LogLevel } from "./logger.js";

export const LIVE_WIREWEAVE_PIN = "5d451241587181e471e263f44db993ba8e2d5764";
export const DEVELOPMENT_WIREWEAVE_PIN = "4508d66ff4cd3fde31959cc8b998810f367be321";
export const LIVE_PAGES_URL = "https://anentrypoint.github.io/zellous/";
export const LIVE_DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://relay.primal.net",
  "wss://nos.lol",
  "wss://relay.snort.social"
];
export const DEFAULT_RELAYS = LIVE_DEFAULT_RELAYS;

export class SecretString {
  private readonly value: string;

  constructor(value: string) {
    this.value = value;
  }

  reveal(): string {
    return this.value;
  }

  toString(): string {
    return "[REDACTED]";
  }

  toJSON(): string {
    return "[REDACTED]";
  }
}

export interface Config {
  discordToken: SecretString;
  discordGuildId: string;
  voiceTokens: SecretString[];
  voiceIdentityCapacity: number;
  privilegedIntentsEnabled: boolean;
  nostrRelays: string[];
  relaySource: string;
  zellousServerId: string;
  zellousServerDTag: string;
  zellousServerName: string;
  bridgeStateDir: string;
  bridgePrivateKeyHex: SecretString | null;
  logLevel: LogLevel;
  healthPort: number;
  reconcileIntervalMs: number;
  heartbeatMs: number;
  voiceWorkerCount: number;
  liveInventoryMode: "read-only" | "reconcile";
}

const schema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_VOICE_TOKENS: z.string().default(""),
  DISCORD_PRIVILEGED_INTENTS: z.enum(["true", "false", "1", "0"]).default("false"),
  DISCORD_GUILD_ID: z.string().regex(/^[0-9]{17,20}$/).default("367741339393327104"),
  NOSTR_RELAYS: z.string().default(LIVE_DEFAULT_RELAYS.join(",")),
  ZELLOUS_RELAYS: z.string().default(""),
  ZELLOUS_SERVER_ID: z.string().default("auto"),
  ZELLOUS_SERVER_D_TAG: z.string().min(1).default("discord-367741339393327104"),
  ZELLOUS_SERVER_NAME: z.string().min(1).default("Discord Bridge"),
  BRIDGE_STATE_DIR: z.string().min(1).default("./data"),
  BRIDGE_PRIVATE_KEY_HEX: z.string().default(""),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  HEALTH_PORT: z.coerce.number().int().min(0).max(65535).default(8789),
  RECONCILE_INTERVAL_MS: z.coerce.number().int().min(1000).default(60000),
  HEARTBEAT_MS: z.coerce.number().int().min(1000).default(15000),
  VOICE_WORKER_COUNT: z.coerce.number().int().min(1).max(64).default(4),
  LIVE_INVENTORY_MODE: z.enum(["read-only", "reconcile"]).default("read-only")
});

export function parseEnvText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of text.split(String.fromCharCode(10))) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).replace("export ", "").trim();
    let value = line.slice(index + 1).trim();
    const first = value.charCodeAt(0);
    const last = value.charCodeAt(value.length - 1);
    if ((first === 34 && last === 34) || (first === 39 && last === 39)) value = value.slice(1, -1);
    result[key] = value;
  }
  return result;
}

function isPlaceholder(value: string): boolean {
  return value.length === 0 || value.startsWith("replace-with") || value.startsWith("<") || value.startsWith("your-") || value.startsWith("[");
}

function parseRelays(value: string): string[] {
  const relays = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (relays.length === 0 || relays.some((relay) => !relay.startsWith("wss://"))) throw new Error("Relay override must be comma-separated wss URLs");
  return relays;
}

function selectedRelays(parsed: { NOSTR_RELAYS: string; ZELLOUS_RELAYS: string }): { value: string; source: string } {
  const live = LIVE_DEFAULT_RELAYS.join(",");
  const override = parsed.ZELLOUS_RELAYS.trim();
  if (override) return { value: override, source: "ZELLOUS_RELAYS" };
  const legacy = parsed.NOSTR_RELAYS.trim();
  if (legacy && legacy !== live) return { value: legacy, source: "NOSTR_RELAYS" };
  return { value: live, source: "live-pages-default" };
}

function parseVoiceTokens(pool: string, environment: Record<string, string>): SecretString[] {
  const values = pool.split(",").map((item) => item.trim()).filter((value) => value.length > 0 && !isPlaceholder(value));
  for (let index = 1; index <= 64; index += 1) {
    const value = environment["DISCORD_VOICE_TOKEN_" + String(index)];
    if (value && !isPlaceholder(value)) values.push(value);
  }
  const unique = [...new Set(values)];
  if (unique.length !== values.length) throw new Error("DISCORD_VOICE_TOKENS contains a duplicate token");
  return unique.map((value) => new SecretString(value));
}

export function loadConfig(environment: Record<string, string>): Config {
  const parsed = schema.parse(environment);
  const voiceTokens = parseVoiceTokens(parsed.DISCORD_VOICE_TOKENS, environment);
  const relays = selectedRelays(parsed);
  if (isPlaceholder(parsed.DISCORD_TOKEN)) throw new Error("DISCORD_TOKEN must not be a placeholder");
  if (parsed.BRIDGE_PRIVATE_KEY_HEX && !/^[0-9a-fA-F]{64}$/.test(parsed.BRIDGE_PRIVATE_KEY_HEX)) throw new Error("BRIDGE_PRIVATE_KEY_HEX must be 64 hex characters");
  return {
    discordToken: new SecretString(parsed.DISCORD_TOKEN),
    discordGuildId: parsed.DISCORD_GUILD_ID,
    voiceTokens,
    voiceIdentityCapacity: voiceTokens.length,
    privilegedIntentsEnabled: parsed.DISCORD_PRIVILEGED_INTENTS === "true" || parsed.DISCORD_PRIVILEGED_INTENTS === "1",
    nostrRelays: parseRelays(relays.value),
    relaySource: relays.source,
    zellousServerId: parsed.ZELLOUS_SERVER_ID,
    zellousServerDTag: parsed.ZELLOUS_SERVER_D_TAG,
    zellousServerName: parsed.ZELLOUS_SERVER_NAME,
    bridgeStateDir: parsed.BRIDGE_STATE_DIR,
    bridgePrivateKeyHex: parsed.BRIDGE_PRIVATE_KEY_HEX ? new SecretString(parsed.BRIDGE_PRIVATE_KEY_HEX) : null,
    logLevel: parsed.LOG_LEVEL,
    healthPort: parsed.HEALTH_PORT,
    reconcileIntervalMs: parsed.RECONCILE_INTERVAL_MS,
    heartbeatMs: parsed.HEARTBEAT_MS,
    voiceWorkerCount: parsed.VOICE_WORKER_COUNT,
    liveInventoryMode: parsed.LIVE_INVENTORY_MODE
  };
}

export function loadConfigFromEnvFile(path = ".env", overrides: Record<string, string> = process.env as Record<string, string>): Config {
  let fileValues: Record<string, string> = {};
  try { fileValues = parseEnvText(readFileSync(path, "utf8")); } catch { fileValues = {}; }
  return loadConfig({ ...fileValues, ...overrides });
}