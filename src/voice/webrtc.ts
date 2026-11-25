import { MediaStreamTrack, RTCPeerConnection, useOPUS } from "werift";
import { voiceRoomId } from "../nostr.js";
import type { VoiceFrame, VoiceSignal } from "../types.js";

export class WeriftVoicePeer {
  private readonly pc: RTCPeerConnection;
  private readonly track: MediaStreamTrack;
  private readonly remoteFrames: VoiceFrame[] = [];

  constructor(private readonly serverId: string, private readonly channelName: string, private readonly fromPubkey: string, private readonly toPubkey: string, private readonly direction: "discord-to-zellous" | "zellous-to-discord") {
    this.pc = new RTCPeerConnection({ codecs: { audio: [useOPUS()], video: [] } });
    this.track = new MediaStreamTrack({ kind: "audio" });
    const transceiver = this.pc.addTransceiver(this.track, { direction: "sendrecv" });
    transceiver.onTrack.subscribe((remoteTrack) => {
      remoteTrack.onReceiveRtp.subscribe((packet) => {
        const payload = Buffer.isBuffer(packet) ? packet : Buffer.from((packet as { payload?: Buffer }).payload ?? Buffer.alloc(0));
        this.remoteFrames.push({ voiceId: this.fromPubkey, direction: this.direction, opusPayload: payload.toString("base64"), ssrc: 0, sequence: 0, timestamp: 0, sampleRate: 48000, channels: 2, codec: "opus", marker: false });
      });
    });
  }

  async offer(): Promise<VoiceSignal> {
    const description = await this.pc.createOffer();
    await this.pc.setLocalDescription(description);
    return this.signal("offer", String(description.sdp ?? ""), null);
  }

  async answer(offer: VoiceSignal): Promise<VoiceSignal> {
    await this.pc.setRemoteDescription({ type: "offer", sdp: offer.sdp ?? "" });
    const description = await this.pc.createAnswer();
    await this.pc.setLocalDescription(description);
    return this.signal("answer", String(description.sdp ?? ""), null);
  }

  async accept(answer: VoiceSignal): Promise<void> {
    await this.pc.setRemoteDescription({ type: "answer", sdp: answer.sdp ?? "" });
  }

  async addIce(candidate: unknown): Promise<void> {
    await this.pc.addIceCandidate(candidate);
  }

  writeFrame(frame: VoiceFrame): void {
    this.track.writeRtp(Buffer.from(frame.opusPayload, "base64"));
  }

  frames(): VoiceFrame[] {
    return [...this.remoteFrames];
  }

  close(): void {
    this.pc.close();
  }

  private signal(signalType: "offer" | "answer" | "ice", sdp: string | null, iceCandidate: unknown): VoiceSignal {
    const roomId = voiceRoomId(this.serverId, this.channelName);
    const dTag = "zellous-rtc:" + roomId + ":" + this.fromPubkey + ":" + this.toPubkey + ":" + signalType + ":" + String(Date.now());
    return { signalType, sdp, iceCandidate: iceCandidate as VoiceSignal["iceCandidate"], fromPubkey: this.fromPubkey, toPubkey: this.toPubkey, roomId, dTag, pTag: this.toPubkey, rTag: roomId };
  }
}