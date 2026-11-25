import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { createCanonicalEvent, recordFromEvent } from "./canonical.js";
import type { CanonicalEvent, LedgerRecord, LedgerState, MessageRecord, PresenceRecord, ProfileRecord, RoomRecord, Source, VoiceRecord, VoiceWorkerRecord, Operation } from "./types.js";

const nl = String.fromCharCode(10);

export interface AppendResult {
  duplicate: boolean;
  eventId: string;
}

function emptyState(): LedgerState {
  return {
    seen: new Map(),
    rooms: new Map(),
    roomsByDiscordId: new Map(),
    roomsByZellousId: new Map(),
    messages: new Map(),
    messagesByDiscordId: new Map(),
    messagesByZellousId: new Map(),
    presence: new Map(),
    profiles: new Map(),
    voice: new Map(),
    voiceWorkers: new Map(),
    suppressions: new Map(),
    identities: new Map(),
    checkpoints: new Map()
  };
}

function bridgeActor(source: Source) {
  return { source, sourceUserId: "bridge", bridgePubkey: null, displayName: "bridge", avatarUrl: null };
}

export class Ledger {
  private readonly stateValue: LedgerState;

  constructor(private readonly path: string) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.stateValue = emptyState();
    this.load();
  }

  getState(): LedgerState {
    return this.stateValue;
  }

  load(): void {
    if (!existsSync(this.path)) return;
    const text = readFileSync(this.path, "utf8");
    for (const line of text.split(nl)) {
      if (!line.trim()) continue;
      this.applyRecord(JSON.parse(line) as LedgerRecord);
    }
  }

  append(record: LedgerRecord): AppendResult {
    if (this.stateValue.seen.has(record.idempotencyKey)) return { duplicate: true, eventId: this.stateValue.seen.get(record.idempotencyKey) ?? record.eventId };
    const fd = openSync(this.path, "a");
    try {
      writeSync(fd, JSON.stringify(record) + nl);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.applyRecord(record);
    return { duplicate: false, eventId: record.eventId };
  }

  appendEvent(event: CanonicalEvent, kind = "canonical"): AppendResult {
    return this.append(recordFromEvent(event, kind));
  }

  hasIdempotencyKey(key: string): boolean {
    return this.stateValue.seen.has(key);
  }

  isSuppressed(eventId: string): boolean {
    return this.stateValue.suppressions.has(eventId);
  }

  basicEvent(source: Source, sourceId: string, operation: Operation, version: number, payload: Record<string, unknown>): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source,
      sourceId,
      operation,
      version,
      occurredAt: Date.now(),
      actor: bridgeActor(source),
      room: null,
      payload,
      suppressionKey: null,
      tracing: []
    });
  }

  createSuppression(eventId: string, targetSource: Source, targetId: string): AppendResult {
    const event = this.basicEvent("bridge", eventId, "suppression", 1, { eventId, targetSource, targetId });
    return this.appendEvent(event, "suppression");
  }

  createCheckpoint(source: Source, version: number): AppendResult {
    const event = this.basicEvent(source, source + ":" + String(version), "checkpoint", version, { source, version });
    return this.appendEvent(event, "checkpoint");
  }

  createIdentity(identityKey: string, pubkey: string): AppendResult {
    const event = this.basicEvent("bridge", identityKey, "suppression", 1, { identityKey, pubkey });
    return this.appendEvent(event, "identity");
  }

  private applyRecord(record: LedgerRecord): void {
    this.stateValue.seen.set(record.idempotencyKey, record.eventId);
    const room = record.payload.room as RoomRecord | undefined;
    if (room) {
      this.stateValue.rooms.set(room.roomId, room);
      if (room.discordId) this.stateValue.roomsByDiscordId.set(room.discordId, room.roomId);
      if (room.zellousId) this.stateValue.roomsByZellousId.set(room.zellousId, room.roomId);
    }
    const message = record.payload.message as MessageRecord | undefined;
    if (message) {
      this.stateValue.messages.set(message.messageId, message);
      if (message.discordId) this.stateValue.messagesByDiscordId.set(message.discordId, message.messageId);
      if (message.zellousEventId) this.stateValue.messagesByZellousId.set(message.zellousEventId, message.messageId);
    }
    const presence = record.payload.presence as PresenceRecord | undefined;
    if (presence) this.stateValue.presence.set(presence.userId, presence);
    const profile = record.payload.profile as ProfileRecord | undefined;
    if (profile) this.stateValue.profiles.set(profile.userId, profile);
    const voice = record.payload.voice as VoiceRecord | undefined;
    if (voice) this.stateValue.voice.set(voice.voiceId, voice);
    const worker = record.payload.worker as VoiceWorkerRecord | undefined;
    if (worker) this.stateValue.voiceWorkers.set(worker.workerId, worker);
    if (record.kind === "suppression") this.stateValue.suppressions.set(record.eventId, record.payload);
    const identityKey = record.payload.identityKey as string | undefined;
    const pubkey = record.payload.pubkey as string | undefined;
    if (identityKey && pubkey) this.stateValue.identities.set(identityKey, pubkey);
    const source = record.payload.source as string | undefined;
    const version = record.payload.version as number | undefined;
    if (source && typeof version === "number") this.stateValue.checkpoints.set(source, version);
  }
}