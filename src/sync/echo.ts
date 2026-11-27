import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface EchoState {
  discordIds: string[];
  zellousIds: string[];
  nonces: string[];
}

export class BridgeEchoStore {
  private readonly path: string;
  private discordIds: Set<string>;
  private zellousIds: Set<string>;
  private nonces: Set<string>;

  constructor(stateDir: string) {
    mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    this.path = join(stateDir, "bridge-echoes.json");
    const state = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")) as EchoState : { discordIds: [], zellousIds: [], nonces: [] };
    this.discordIds = new Set(state.discordIds ?? []);
    this.zellousIds = new Set(state.zellousIds ?? []);
    this.nonces = new Set(state.nonces ?? []);
  }

  private persist(): void {
    const state: EchoState = { discordIds: [...this.discordIds], zellousIds: [...this.zellousIds], nonces: [...this.nonces] };
    writeFileSync(this.path, JSON.stringify(state), { mode: 0o600 });
  }

  rememberDiscord(id: string): void {
    if (!id) return;
    this.discordIds.add(id);
    this.persist();
  }

  isDiscord(id: string): boolean {
    return this.discordIds.has(id);
  }

  rememberZellous(id: string): void {
    if (!id) return;
    this.zellousIds.add(id);
    this.persist();
  }

  isZellous(id: string): boolean {
    return this.zellousIds.has(id);
  }

  rememberNonce(nonce: string): void {
    if (!nonce) return;
    this.nonces.add(nonce);
    this.persist();
  }

  isNonce(nonce: string): boolean {
    return this.nonces.has(nonce);
  }

  counts(): { discordIds: number; zellousIds: number; nonces: number } {
    return { discordIds: this.discordIds.size, zellousIds: this.zellousIds.size, nonces: this.nonces.size };
  }
}
