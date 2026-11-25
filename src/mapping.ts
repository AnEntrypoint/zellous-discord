import { createCanonicalEvent } from "./canonical.js";
import type { Ledger } from "./ledger.js";
import type { MessageRecord, RoomRecord, RoomRef, Source } from "./types.js";

function roomRef(room: RoomRecord): RoomRef {
  return {
    roomId: room.roomId,
    discordId: room.discordId,
    zellousId: room.zellousId,
    serverId: room.serverId,
    guildId: room.guildId,
    type: room.type,
    parentId: room.parentId,
    position: room.position,
    name: room.name,
    topic: room.topic
  };
}

function eventFor(source: Source, sourceId: string, operation: "room.upsert" | "room.tombstone" | "message.create", version: number, payload: Record<string, unknown>, room: RoomRef | null) {
  return createCanonicalEvent({
    schemaVersion: 1,
    source,
    sourceId,
    operation,
    version,
    occurredAt: Date.now(),
    actor: { source, sourceUserId: "bridge", bridgePubkey: null, displayName: "bridge", avatarUrl: null },
    room,
    payload,
    suppressionKey: null,
    tracing: []
  });
}

export class MappingStore {
  constructor(private readonly ledger: Ledger) {}

  upsertRoom(room: RoomRecord, source: Source) {
    const event = eventFor(source, room.discordId ?? room.zellousId ?? room.roomId, "room.upsert", room.contentVersion, { room }, roomRef(room));
    return this.ledger.appendEvent(event, "room.upsert");
  }

  tombstoneRoom(room: RoomRecord, source: Source) {
    const tombstone = { ...room, tombstone: true, deletedAt: Date.now(), contentVersion: room.contentVersion + 1 };
    const event = eventFor(source, room.discordId ?? room.zellousId ?? room.roomId, "room.tombstone", tombstone.contentVersion, { room: tombstone }, roomRef(tombstone));
    return this.ledger.appendEvent(event, "room.tombstone");
  }

  upsertMessage(message: MessageRecord, source: Source) {
    const event = eventFor(source, message.discordId ?? message.zellousEventId ?? message.messageId, "message.create", message.contentVersion, { message }, null);
    return this.ledger.appendEvent(event, "message.upsert");
  }

  getRoomByDiscordId(id: string): RoomRecord | undefined {
    const roomId = this.ledger.getState().roomsByDiscordId.get(id);
    return roomId ? this.ledger.getState().rooms.get(roomId) : undefined;
  }

  getRoomByZellousId(id: string): RoomRecord | undefined {
    const roomId = this.ledger.getState().roomsByZellousId.get(id);
    return roomId ? this.ledger.getState().rooms.get(roomId) : undefined;
  }

  getMessageByDiscordId(id: string): MessageRecord | undefined {
    const messageId = this.ledger.getState().messagesByDiscordId.get(id);
    return messageId ? this.ledger.getState().messages.get(messageId) : undefined;
  }

  getMessageByZellousId(id: string): MessageRecord | undefined {
    const messageId = this.ledger.getState().messagesByZellousId.get(id);
    return messageId ? this.ledger.getState().messages.get(messageId) : undefined;
  }

  allRooms(): RoomRecord[] {
    return Array.from(this.ledger.getState().rooms.values());
  }
}