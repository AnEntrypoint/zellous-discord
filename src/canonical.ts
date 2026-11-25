import { createHash } from "node:crypto";
import type { ActorRef, CanonicalEvent, LedgerRecord, Operation, RoomRef, Source } from "./types.js";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return String(JSON.stringify(value));
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return "{" + keys.map((key) => JSON.stringify(key) + ":" + stable(object[key])).join(",") + "}";
}

export function canonicalize(value: unknown): string {
  return stable(value);
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

export function makeIdempotencyKey(source: Source, sourceId: string, operation: Operation, version: number): string {
  return createHash("sha256").update([source, sourceId, operation, String(version)].join("|")).digest("hex");
}

export function eventIdOf(event: Omit<CanonicalEvent, "eventId" | "idempotencyKey">): string {
  return hashCanonical({
    schemaVersion: event.schemaVersion,
    source: event.source,
    sourceId: event.sourceId,
    operation: event.operation,
    version: event.version,
    occurredAt: event.occurredAt,
    actor: event.actor,
    room: event.room,
    payload: event.payload,
    suppressionKey: event.suppressionKey,
    tracing: event.tracing
  });
}

export function createCanonicalEvent(input: Omit<CanonicalEvent, "eventId" | "idempotencyKey">): CanonicalEvent {
  const idempotencyKey = makeIdempotencyKey(input.source, input.sourceId, input.operation, input.version);
  const eventId = eventIdOf(input);
  return { ...input, eventId, idempotencyKey };
}

export function recordFromEvent(event: CanonicalEvent, kind: string): LedgerRecord {
  return {
    kind,
    eventId: event.eventId,
    source: event.source,
    sourceId: event.sourceId,
    operation: event.operation,
    version: event.version,
    idempotencyKey: event.idempotencyKey,
    occurredAt: event.occurredAt,
    payload: event.payload
  };
}

export function eventFromRecord(record: LedgerRecord): CanonicalEvent {
  return {
    schemaVersion: 1,
    eventId: record.eventId,
    source: record.source,
    sourceId: record.sourceId,
    operation: record.operation,
    version: record.version,
    idempotencyKey: record.idempotencyKey,
    occurredAt: record.occurredAt,
    actor: (record.payload.actor as ActorRef) ?? { source: record.source, sourceUserId: "", bridgePubkey: null, displayName: "bridge", avatarUrl: null },
    room: (record.payload.room as RoomRef | null) ?? null,
    payload: record.payload,
    suppressionKey: null,
    tracing: []
  };
}