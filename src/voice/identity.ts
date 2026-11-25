import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveSecretKey, discordIdentityKey, loadOrCreateSeed, publicKeyHex, zellousIdentityKey } from "../identity.js";
import type { Source } from "../types.js";

export class VoiceIdentityLedger {
  private readonly path: string;
  private readonly values: Record<string, string>;
  private readonly seed: Uint8Array;

  constructor(stateDir: string) {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    this.path = join(stateDir, "voice-identities.json");
    this.values = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")) as Record<string, string> : {};
    this.seed = loadOrCreateSeed(stateDir);
  }

  resolve(source: Source, userId: string): { identityKey: string; pubkey: string } {
    const identityKey = source === "discord" ? discordIdentityKey(userId) : zellousIdentityKey(userId);
    let pubkey = this.values[identityKey];
    if (!pubkey) {
      pubkey = publicKeyHex(deriveSecretKey(this.seed, identityKey));
      this.values[identityKey] = pubkey;
      writeFileSync(this.path, JSON.stringify(this.values), { mode: 0o600 });
    }
    return { identityKey, pubkey };
  }

  count(): number {
    return Object.keys(this.values).length;
  }
}