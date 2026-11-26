import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPublicKey } from "nostr-tools/pure";
import { OWNER_HEX, type Config } from "./config.js";

export function loadOrCreateSeed(stateDir: string): Uint8Array {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, "bridge-seed.json");
  if (existsSync(path)) {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { seedHex: string };
    return Uint8Array.from(Buffer.from(parsed.seedHex, "hex"));
  }
  const seed = randomBytes(32);
  writeFileSync(path, JSON.stringify({ seedHex: Buffer.from(seed).toString("hex") }), { mode: 0o600 });
  return new Uint8Array(seed);
}

export function deriveSecretKey(seed: Uint8Array, identity: string): Uint8Array {
  for (let counter = 0; counter < 256; counter += 1) {
    const digest = createHmac("sha256", seed).update(identity + ":" + String(counter)).digest();
    const candidate = new Uint8Array(digest);
    try { getPublicKey(candidate); return candidate; } catch {}
  }
  throw new Error("could not derive a valid secp256k1 secret");
}

export function publicKeyHex(secretKey: Uint8Array): string {
  return getPublicKey(secretKey);
}

export function ownerHex(config: Config): string {
  return config.zellousServerOwnerHex || OWNER_HEX;
}

export function resolveServerId(config: Config, owner = ownerHex(config)): string {
  return config.zellousServerId === "auto" ? owner + ":" + config.zellousServerDTag : config.zellousServerId;
}

export function discordIdentityKey(userId: string): string {
  return "discord:" + userId;
}

export function zellousIdentityKey(pubkey: string): string {
  return "zellous:" + pubkey;
}

export function bridgeSecretKey(config: Config): Uint8Array {
  const seed = loadOrCreateSeed(config.bridgeStateDir);
  const configuredKey = config.bridgePrivateKeyHex;
  if (configuredKey) return Uint8Array.from(Buffer.from(configuredKey.reveal(), "hex"));
  return deriveSecretKey(seed, "bridge");
}

export function requireOwnerKey(config: Config): Uint8Array {
  if (!config.bridgePrivateKeyHex) throw new Error("owner private key missing: set BRIDGE_PRIVATE_KEY_HEX in .env");
  const secretKey = bridgeSecretKey(config);
  if (publicKeyHex(secretKey) !== ownerHex(config)) throw new Error("owner private key does not match ZELLOUS_SERVER_OWNER_HEX");
  return secretKey;
}