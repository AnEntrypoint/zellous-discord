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
  createMediaStreamSource(): { connect: () => void } {
    return { connect: () => {} };
  }
  createAnalyser(): { fftSize: number; getByteFrequencyData: () => void } {
    return { fftSize: 2048, getByteFrequencyData: () => {} };
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

class NodeAudioWorkletNode {
  port = { postMessage: () => {} };
  connect(): void {}
}

function fileStorage(stateDir: string) {
  mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const path = join(stateDir, "wireweave-storage.json");
  let values: Record<string, string> = {};
  try { values = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as Record<string, string> : {}; } catch { values = {}; }
  const persist = () => writeFileSync(path, JSON.stringify(values), { mode: 0o600 });
  return {
    getItem: (key: string) => values[key] ?? null,
    setItem: (key: string, value: string) => { values[key] = value; persist(); },
    removeItem: (key: string) => { delete values[key]; persist(); }
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

export function createNodeWireweave(config: Config): any {
  installNodeMediaGlobals();
  const ww = createWireweave({
    nostrTools: NostrTools,
    xstate: XState,
    storage: fileStorage(config.bridgeStateDir),
    relays: config.nostrRelays,
    WebSocketImpl: WebSocket,
    mediaDevices: (globalThis as unknown as { navigator: { mediaDevices: unknown } }).navigator.mediaDevices
  });
  const secretKey = bridgeSecretKey(config);
  ww.auth.importKey(Buffer.from(secretKey).toString("hex"));
  ww.pool.connect();
  ww.servers.init();
  return ww;
}