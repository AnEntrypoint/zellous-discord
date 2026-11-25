import { Worker } from "node:worker_threads";
import { AudioRouter } from "./router.js";
import type { VoiceFrame } from "../types.js";

export interface RoutedFrame {
  identity: string;
  direction: "discord-to-zellous" | "zellous-to-discord";
  accepted: boolean;
  frame: VoiceFrame;
}

export class VoiceWorkerPool {
  private readonly workers = new Map<string, Worker>();
  private readonly router = new AudioRouter();
  private readonly routed: RoutedFrame[] = [];
  private readonly workerUrl: URL;

  constructor() {
    const workerFile = import.meta.url.endsWith(".ts") ? "./worker.ts" : "./worker.js";
    this.workerUrl = new URL(workerFile, import.meta.url);
  }

  start(identity: string, direction: "discord-to-zellous" | "zellous-to-discord"): void {
    if (this.workers.has(identity)) return;
    const worker = new Worker(this.workerUrl);
    worker.on("message", (message: any) => {
      if (message.type === "routed") {
        this.router.write(message.frame);
        this.routed.push({ identity: message.identity, direction: message.direction, accepted: message.accepted, frame: message.frame });
      }
    });
    this.workers.set(identity, worker);
    this.router.ensure(identity, direction);
    worker.postMessage({ type: "start", identity, direction });
  }

  send(identity: string, frame: VoiceFrame): void {
    const worker = this.workers.get(identity);
    if (!worker) throw new Error("voice worker not started for " + identity);
    worker.postMessage({ type: "frame", frame });
  }

  mute(identity: string, value: boolean): void {
    this.router.setMuted(identity, value);
    this.workers.get(identity)?.postMessage({ type: "mute", identity, value });
  }

  deafen(identity: string, value: boolean): void {
    this.router.setDeafened(identity, value);
    this.workers.get(identity)?.postMessage({ type: "deafen", identity, value });
  }

  speaking(identity: string, value: boolean): void {
    this.router.setSpeaking(identity, value);
    this.workers.get(identity)?.postMessage({ type: "speaking", identity, value });
  }

  leave(identity: string): void {
    this.router.leave(identity);
    this.workers.get(identity)?.postMessage({ type: "leave", identity });
  }

  async stop(identity: string): Promise<void> {
    const worker = this.workers.get(identity);
    if (!worker) return;
    worker.postMessage({ type: "stop" });
    await worker.terminate();
    this.workers.delete(identity);
  }

  async stopAll(): Promise<void> {
    for (const identity of Array.from(this.workers.keys())) await this.stop(identity);
    this.router.close();
  }

  state(identity: string) {
    return this.router.state(identity);
  }

  frames(identity: string): VoiceFrame[] {
    return this.router.frames(identity);
  }

  routedFrames(): RoutedFrame[] {
    return [...this.routed];
  }

  workerCount(): number {
    return this.workers.size;
  }
}