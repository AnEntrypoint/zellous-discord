import { PassThrough } from "node:stream";
import type { VoiceFrame } from "../types.js";

export interface VoiceStreamState {
  identity: string;
  direction: "discord-to-zellous" | "zellous-to-discord";
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  leave: boolean;
  frames: VoiceFrame[];
}

export class AudioRouter {
  private readonly streams = new Map<string, PassThrough>();
  private readonly states = new Map<string, VoiceStreamState>();

  ensure(identity: string, direction: "discord-to-zellous" | "zellous-to-discord"): VoiceStreamState {
    let state = this.states.get(identity);
    if (!state) {
      state = { identity, direction, speaking: false, muted: false, deafened: false, leave: false, frames: [] };
      this.states.set(identity, state);
      this.streams.set(identity, new PassThrough());
    }
    return state;
  }

  stream(identity: string): PassThrough | undefined {
    return this.streams.get(identity);
  }

  write(frame: VoiceFrame): boolean {
    const state = this.ensure(frame.voiceId, frame.direction);
    if (state.muted || state.leave) return false;
    state.speaking = true;
    state.frames.push(frame);
    this.streams.get(frame.voiceId)?.write(Buffer.from(frame.opusPayload, "base64"));
    return true;
  }

  setMuted(identity: string, muted: boolean): void {
    this.ensure(identity, "discord-to-zellous").muted = muted;
  }

  setDeafened(identity: string, deafened: boolean): void {
    this.ensure(identity, "discord-to-zellous").deafened = deafened;
  }

  setSpeaking(identity: string, speaking: boolean): void {
    this.ensure(identity, "discord-to-zellous").speaking = speaking;
  }

  leave(identity: string): void {
    const state = this.ensure(identity, "discord-to-zellous");
    state.leave = true;
    state.speaking = false;
    this.streams.get(identity)?.end();
  }

  state(identity: string): VoiceStreamState | undefined {
    return this.states.get(identity);
  }

  frames(identity: string): VoiceFrame[] {
    return this.state(identity)?.frames ?? [];
  }

  identities(): string[] {
    return Array.from(this.states.keys());
  }

  close(): void {
    for (const stream of this.streams.values()) stream.end();
  }
}