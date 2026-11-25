import { AudioRouter } from "./router.js";
import type { VoiceFrame } from "../types.js";

export interface RoutedFrame {
  identity: string;
  direction: "discord-to-zellous" | "zellous-to-discord";
  accepted: boolean;
  frame: VoiceFrame;
}

export class VoiceWorkerPool {
  private readonly workers = new Map<string, AudioRouter>();
  private readonly routed: RoutedFrame[] = [];

  start(identity: string, direction: "discord-to-zellous" | "zellous-to-discord"): void {
    if (this.workers.has(identity)) return;
    const router = new AudioRouter();
    router.ensure(identity, direction);
    this.workers.set(identity, router);
  }

  send(identity: string, frame: VoiceFrame): void {
    const router = this.workers.get(identity);
    if (!router) throw new Error("voice worker not started for " + identity);
    const accepted = router.write(frame);
    this.routed.push({ identity: frame.voiceId, direction: frame.direction, accepted, frame });
  }

  mute(identity: string, value: boolean): void {
    this.workers.get(identity)?.setMuted(identity, value);
  }

  deafen(identity: string, value: boolean): void {
    this.workers.get(identity)?.setDeafened(identity, value);
  }

  speaking(identity: string, value: boolean): void {
    this.workers.get(identity)?.setSpeaking(identity, value);
  }

  leave(identity: string): void {
    this.workers.get(identity)?.leave(identity);
  }

  async stop(identity: string): Promise<void> {
    const router = this.workers.get(identity);
    if (!router) return;
    router.close();
    this.workers.delete(identity);
  }

  async stopAll(): Promise<void> {
    for (const identity of Array.from(this.workers.keys())) await this.stop(identity);
  }

  state(identity: string) {
    return this.workers.get(identity)?.state(identity);
  }

  frames(identity: string): VoiceFrame[] {
    return this.workers.get(identity)?.frames(identity) ?? [];
  }

  routedFrames(): RoutedFrame[] {
    return [...this.routed];
  }

  workerCount(): number {
    return this.workers.size;
  }
}