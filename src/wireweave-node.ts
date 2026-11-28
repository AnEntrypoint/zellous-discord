import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as NostrTools from "nostr-tools";
import * as XState from "xstate";
import WebSocket from "ws";
import { createEmptyRegister, installPolyfill } from "werift/polyfill";
import { createWireweave } from "wireweave/wireweave";
import type { Config } from "./config.js";
import { bridgeSecretKey } from "./identity.js";

class NodeMediaStreamTrack {
  enabled = true;
  kind = "audio";
  stop(): void {}
}

class NodeMediaStream {
  getAudioTracks(): NodeMediaStreamTrack[] {
    return [new NodeMediaStreamTrack()];
  }
  getTracks(): NodeMediaStreamTrack[] {
    return this.getAudioTracks();
  }
}

class NodeAudioElement {
  autoplay = false;
  playsInline = false;
  muted = false;
  volume = 1;
  style = { display: "none" };
  dataset: Record<string, string> = {};
  srcObject: unknown = null;
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
  remove(): void {}
}

class NodeRTCSessionDescription {
  constructor(init: Record<string, unknown>) {
    Object.assign(this, init);
  }
}

class NodeRTCIceCandidate {
  constructor(init: Record<string, unknown>) {
    Object.assign(this, init);
  }
}

class NodeAudioContext {
  state = "running";
  createMediaStreamDestination(): { stream: NodeMediaStream; connect: () => void } {
    return { stream: new NodeMediaStream(), connect: () => {} };
  }
  createGain(): { gain: { value: number }; connect: () => void; disconnect: () => void } {
    return { gain: { value: 1 }, connect: () => {}, disconnect: () => {} };
  }
  createMediaStreamSource(): { connect: () => void } {
    return { connect: () => {} };
  }
  createAnalyser(): { fftSize: number; frequencyBinCount: number; smoothingTimeConstant: number; getByteFrequencyData: (buffer?: Uint8Array) => void; getByteTimeDomainData: (buffer?: Uint8Array) => void; getFloatTimeDomainData: (buffer?: Float32Array) => void; connect: () => void; disconnect: () => void } {
    return { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0, getByteFrequencyData: () => {}, getByteTimeDomainData: (buffer?: Uint8Array) => { buffer?.fill(128); }, getFloatTimeDomainData: (buffer?: Float32Array) => { buffer?.fill(0); }, connect: () => {}, disconnect: () => {} };
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

class NodeAudioWorkletNode {
  port = { postMessage: () => {} };
  connect(): void {}
}

export function fileStorage(stateDir: string) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, "wireweave-storage.json");
  const load = function(): Record<string, string> {
    try { return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, string> : {}; } catch { return {}; }
  };
  const persist = function(values: Record<string, string>): void { writeFileSync(path, JSON.stringify(values), { mode: 0o600 }); };
  const mergeServerIcons = function(values: Record<string, string>, value: string): string {
    try {
      const previous = JSON.parse(values.zn_servers ?? "[]") as Array<Record<string, unknown>>;
      const next = JSON.parse(value) as Array<Record<string, unknown>>;
      for (const server of next) {
        const found = previous.find(function(item) { return item.id === server.id; });
        if (found && typeof found.icon === "string" && found.icon) server.icon = found.icon;
      }
      return JSON.stringify(next);
    } catch { return value; }
  };
  return {
    getItem: (key: string) => load()[key] ?? null,
    setItem: (key: string, value: string) => {
      const values = load();
      values[key] = key === "zn_servers" ? mergeServerIcons(values, value) : value;
      persist(values);
    },
    removeItem: (key: string) => {
      const values = load();
      delete values[key];
      persist(values);
    }
  };
}

export function installNodeMediaGlobals(): void {
  const uninstall = installPolyfill({ mediaRegister: [createEmptyRegister()] });
  const target = globalThis as unknown as Record<string, unknown>;
  if (!target.navigator) target.navigator = { mediaDevices: { getUserMedia: async () => new NodeMediaStream() } };
  target.HTMLAudioElement = NodeAudioElement;
  target.AudioContext = NodeAudioContext;
  target.AudioWorkletNode = NodeAudioWorkletNode;
  void uninstall;
}

export interface NodeWireweaveOptions {
  secretKey?: Uint8Array;
  stateSubdir?: string;
  relays?: string[];
}

export function createNodeWireweave(config: Config, options: NodeWireweaveOptions = {}): any {
  installNodeMediaGlobals();
  const ww = createWireweave({
    nostrTools: NostrTools,
    xstate: XState,
    storage: fileStorage(options.stateSubdir ? join(config.bridgeStateDir, options.stateSubdir) : config.bridgeStateDir),
    relays: options.relays ?? config.nostrRelays,
    WebSocketImpl: WebSocket,
    mediaDevices: (globalThis as unknown as { navigator: { mediaDevices: unknown } }).navigator.mediaDevices
  });
  const secretKey = options.secretKey ?? bridgeSecretKey(config);
  ww.auth.importKey(Buffer.from(secretKey).toString("hex"));
  ww.pool.connect();
  ww.servers.init();
  return ww;
}