import { createCanonicalEvent } from "../canonical.js";
import type { Ledger } from "../ledger.js";
import type { MappingStore } from "../mapping.js";
import type { Logger } from "../logger.js";
import { SuppressionStore } from "./suppression.js";
import type { ApplyResult, BridgeAdapter, CanonicalEvent, MessageRecord, Operation, ReconcileResult, RoomRecord, Source } from "../types.js";

function bridgeActor(source: Source) {
  return { source, sourceUserId: "bridge", bridgePubkey: null, displayName: "bridge", avatarUrl: null };
}

export class SyncEngine {
  private readonly suppression: SuppressionStore;
  private unsubscribers: Array<() => Promise<void>> = [];

  constructor(private readonly discord: BridgeAdapter, private readonly zellous: BridgeAdapter, private readonly ledger: Ledger, private readonly mapping: MappingStore, private readonly logger: Logger) {
    this.suppression = new SuppressionStore(ledger);
  }

  async start(): Promise<void> {
    this.unsubscribers = [
      await this.discord.subscribe((event) => this.ingest(event, "discord")),
      await this.zellous.subscribe((event) => this.ingest(event, "zellous"))
    ];
    await this.reconcile();
  }

  async stop(): Promise<void> {
    for (const unsubscribe of this.unsubscribers) await unsubscribe();
    this.unsubscribers = [];
  }

  async restart(): Promise<void> {
    await this.stop();
    const discordReconnect = this.discord as unknown as { reconnect?: () => Promise<void> };
    const zellousReconnect = this.zellous as unknown as { reconnect?: () => Promise<void> };
    if (discordReconnect.reconnect) await discordReconnect.reconnect();
    if (zellousReconnect.reconnect) await zellousReconnect.reconnect();
    await this.start();
  }

  async ingest(event: CanonicalEvent, origin: Source): Promise<ApplyResult> {
    if (this.ledger.hasIdempotencyKey(event.idempotencyKey) || this.suppression.isSuppressed(event.eventId)) {
      return { ok: true, sourceId: event.sourceId, version: event.version, suppressed: true };
    }
    const appended = this.ledger.appendEvent(event, event.operation);
    if (appended.duplicate) return { ok: true, sourceId: event.sourceId, version: event.version, suppressed: true };
    const target = origin === "discord" ? this.zellous : this.discord;
    const translated = this.translateEvent(event, target.source);
    const result = await target.apply(translated);
    this.suppression.suppress(event.eventId, target.source, translated.sourceId);
    const room = translated.payload.room as RoomRecord | undefined;
    if (room) this.mapping.upsertRoom(room, "bridge");
    const message = translated.payload.message as MessageRecord | undefined;
    if (message) this.mapping.upsertMessage(message, "bridge");
    this.logger.debug("synchronized event", { operation: event.operation, source: origin, target: target.source, version: event.version });
    return result;
  }

  async replay(events: CanonicalEvent[]): Promise<number> {
    const sorted = [...events].sort((a, b) => a.version - b.version || a.occurredAt - b.occurredAt);
    let accepted = 0;
    for (const event of sorted) {
      const result = await this.ingest(event, event.source === "bridge" ? "discord" : event.source);
      if (!result.suppressed) accepted += 1;
    }
    return accepted;
  }

  async reconcile(): Promise<ReconcileResult> {
    const result: ReconcileResult = { roomsCreated: 0, roomsUpdated: 0, roomsTombstoned: 0, messagesCreated: 0, messagesUpdated: 0, duplicatesSuppressed: 0 };
    const discord = await this.discord.snapshot();
    const zellous = await this.zellous.snapshot();
    for (const room of discord.rooms) {
      if (!room.discordId || this.mapping.getRoomByDiscordId(room.discordId)) continue;
      const bridged = { ...room, roomId: "room-" + room.discordId, zellousId: "zellous-" + room.discordId, contentVersion: Math.max(room.contentVersion, 1) };
      await this.zellous.apply(this.roomEvent(bridged, "room.upsert", "zellous"));
      this.mapping.upsertRoom(bridged, "bridge");
      result.roomsCreated += 1;
    }
    for (const room of zellous.rooms) {
      if (!room.zellousId || this.mapping.getRoomByZellousId(room.zellousId)) continue;
      const bridged = { ...room, roomId: "room-" + room.zellousId, discordId: "discord-" + room.zellousId, contentVersion: Math.max(room.contentVersion, 1) };
      await this.discord.apply(this.roomEvent(bridged, "room.upsert", "discord"));
      this.mapping.upsertRoom(bridged, "bridge");
      result.roomsCreated += 1;
    }
    for (const mapped of this.mapping.allRooms()) {
      if (mapped.tombstone) continue;
      const discordRoom = discord.rooms.find((room) => room.discordId === mapped.discordId);
      const zellousRoom = zellous.rooms.find((room) => room.zellousId === mapped.zellousId);
      if (!discordRoom && zellousRoom) {
        await this.zellous.apply(this.roomEvent({ ...mapped, tombstone: true, deletedAt: Date.now() }, "room.tombstone", "zellous"));
        this.mapping.tombstoneRoom(mapped, "bridge");
        result.roomsTombstoned += 1;
        continue;
      }
      if (discordRoom && !zellousRoom) {
        await this.discord.apply(this.roomEvent({ ...mapped, tombstone: true, deletedAt: Date.now() }, "room.tombstone", "discord"));
        this.mapping.tombstoneRoom(mapped, "bridge");
        result.roomsTombstoned += 1;
        continue;
      }
      if (discordRoom && zellousRoom && (discordRoom.contentVersion > zellousRoom.contentVersion || this.metadataDiffers(discordRoom, zellousRoom))) {
        const newer = { ...zellousRoom, ...discordRoom, roomId: mapped.roomId, zellousId: mapped.zellousId, discordId: mapped.discordId, contentVersion: Math.max(discordRoom.contentVersion, zellousRoom.contentVersion) + 1 };
        await this.zellous.apply(this.roomEvent(newer, "room.upsert", "zellous"));
        this.mapping.upsertRoom(newer, "bridge");
        result.roomsUpdated += 1;
      }
    }
    this.ledger.createCheckpoint("discord", discord.version);
    this.ledger.createCheckpoint("zellous", zellous.version);
    return result;
  }

  private metadataDiffers(a: RoomRecord, b: RoomRecord): boolean {
    return a.name !== b.name || a.type !== b.type || a.parentId !== b.parentId || a.position !== b.position || a.topic !== b.topic || a.archived !== b.archived;
  }

  private roomEvent(room: RoomRecord, operation: Operation, source: Source): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source,
      sourceId: source === "discord" ? room.discordId ?? room.roomId : room.zellousId ?? room.roomId,
      operation,
      version: room.contentVersion,
      occurredAt: Date.now(),
      actor: bridgeActor(source),
      room: { roomId: room.roomId, discordId: room.discordId, zellousId: room.zellousId, serverId: room.serverId, guildId: room.guildId, type: room.type, parentId: room.parentId, position: room.position, name: room.name, topic: room.topic },
      payload: { room },
      suppressionKey: null,
      tracing: [source]
    });
  }

  private translateEvent(event: CanonicalEvent, targetSource: Source): CanonicalEvent {
    const roomRecord = event.payload.room as RoomRecord | undefined;
    const room = event.room ? { ...event.room } : null;
    let sourceId = event.sourceId;
    if (room && roomRecord) {
      const discordId = roomRecord.discordId ?? roomRecord.zellousId ?? roomRecord.roomId;
      const zellousId = roomRecord.zellousId ?? roomRecord.discordId ?? roomRecord.roomId;
      room.discordId = discordId;
      room.zellousId = zellousId;
      sourceId = targetSource === "discord" ? discordId : zellousId;
    }
    const payload = { ...event.payload };
    if (roomRecord) payload.room = { ...roomRecord, discordId: roomRecord.discordId ?? roomRecord.zellousId ?? roomRecord.roomId, zellousId: roomRecord.zellousId ?? roomRecord.discordId ?? roomRecord.roomId };
    return createCanonicalEvent({
      schemaVersion: event.schemaVersion,
      source: targetSource,
      sourceId,
      operation: event.operation,
      version: event.version,
      occurredAt: Date.now(),
      actor: event.actor,
      room,
      payload,
      suppressionKey: event.eventId,
      tracing: [...event.tracing, targetSource]
    });
  }
}