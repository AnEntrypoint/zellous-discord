import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.js";

export function heldRelays(stateDir: string, now: number = Date.now()): string[] {
  const held = new Set(String(process.env.RELAY_WRITE_HOLD ?? "").split(",").map((url) => url.trim()).filter(Boolean));
  const path = join(stateDir, "relay-write-hold.json");
  if (existsSync(path)) {
    try {
      const file = JSON.parse(readFileSync(path, "utf8")) as { relays?: string[]; until?: string };
      if (Array.isArray(file.relays) && Date.parse(String(file.until ?? "")) > now) for (const url of file.relays) held.add(String(url));
    } catch { }
  }
  return [...held];
}

export function writableRelays(config: Config, now: number = Date.now()): string[] {
  const held = heldRelays(config.bridgeStateDir, now);
  return config.nostrRelays.filter((url) => !held.includes(url));
}
