import { createHash } from "node:crypto";

export const PRESENCE_LIVE_MS = 30000;

export interface VoiceRoomRef {
  roomId: string;
  channelName: string;
  discordId: string;
}

export interface PresenceTransition {
  kind: "join" | "leave";
  pubkey: string;
  room: VoiceRoomRef;
}

export function zellousVoiceRoomId(serverId: string, channelName: string): string {
  return "zellous" + createHash("sha256").update(serverId + ":voice:" + channelName).digest("hex").slice(0, 16);
}

export class VoicePresenceTracker {
  private readonly live = new Map<string, { room: VoiceRoomRef; lastSeen: number; ts: number }>();

  constructor(private readonly liveMs: number = PRESENCE_LIVE_MS) {}

  observe(room: VoiceRoomRef, pubkey: string, action: string, ts: number, now: number): PresenceTransition | null {
    const key = pubkey + ":" + room.roomId;
    const known = this.live.get(key);
    if (action === "leave") {
      if (!known || ts < known.ts) return null;
      this.live.delete(key);
      return { kind: "leave", pubkey, room };
    }
    if (now - ts > this.liveMs) return null;
    if (known && ts < known.ts) return null;
    this.live.set(key, { room, lastSeen: now, ts });
    return known ? null : { kind: "join", pubkey, room };
  }

  sweep(now: number): PresenceTransition[] {
    const leaves: PresenceTransition[] = [];
    for (const [key, value] of [...this.live.entries()]) {
      if (now - value.lastSeen <= this.liveMs) continue;
      this.live.delete(key);
      leaves.push({ kind: "leave", pubkey: key.split(":")[0], room: value.room });
    }
    return leaves;
  }

  size(): number {
    return this.live.size;
  }
}
