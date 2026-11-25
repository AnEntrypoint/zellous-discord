import { parentPort } from "node:worker_threads";
import { AudioRouter } from "./router.js";
import type { VoiceFrame } from "../types.js";

const router = new AudioRouter();

parentPort?.on("message", (message: any) => {
  if (message.type === "start") {
    router.ensure(message.identity, message.direction);
    parentPort?.postMessage({ type: "started", identity: message.identity, direction: message.direction });
    return;
  }
  if (message.type === "frame") {
    const frame = message.frame as VoiceFrame;
    const accepted = router.write(frame);
    parentPort?.postMessage({ type: "routed", identity: frame.voiceId, direction: frame.direction, accepted, frame });
    return;
  }
  if (message.type === "mute") {
    router.setMuted(message.identity, Boolean(message.value));
    parentPort?.postMessage({ type: "state", identity: message.identity, state: router.state(message.identity) });
    return;
  }
  if (message.type === "deafen") {
    router.setDeafened(message.identity, Boolean(message.value));
    parentPort?.postMessage({ type: "state", identity: message.identity, state: router.state(message.identity) });
    return;
  }
  if (message.type === "speaking") {
    router.setSpeaking(message.identity, Boolean(message.value));
    parentPort?.postMessage({ type: "state", identity: message.identity, state: router.state(message.identity) });
    return;
  }
  if (message.type === "leave") {
    router.leave(message.identity);
    parentPort?.postMessage({ type: "state", identity: message.identity, state: router.state(message.identity) });
    return;
  }
  if (message.type === "stop") {
    router.close();
    parentPort?.postMessage({ type: "stopped" });
  }
});