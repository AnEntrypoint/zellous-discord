import { createCanonicalEvent } from "../canonical.js";
import type { AdapterSnapshot, ApplyResult, BridgeAdapter, CanonicalEvent, MessageRecord, Operation, PresenceRecord, ProfileRecord, RoomRecord, RoomType, Source } from "../types.js";

function bridgeActor(source: Source) {
  return { source, sourceUserId: "mock-user", bridgePubkey: null, displayName: "mock", avatarUrl: null };
}

function roomRef(room: RoomRecord) {
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

export class MockAdapter implements BridgeAdapter {
  readonly source: Source;
  private rooms = new Map<string, RoomRecord>();
  private messages = new Map<string, MessageRecord>();
  private presence = new Map<string, PresenceRecord>();
  private profiles = new Map<string, ProfileRecord>();
  private version = 1;
  private counter = 0;
  private connected = true;
  private handler: ((event: CanonicalEvent) => Promise<void>) | null = null;
  private pending: CanonicalEvent[] = [];

  constructor(source: Source, private readonly serverId = "pubkey:discord", private readonly guildId = "367741339393327104") {
    this.source = source;
  }

  async snapshot(): Promise<AdapterSnapshot> {
    return {
      source: this.source,
      version: this.version,
      rooms: Array.from(this.rooms.values()),
      messages: Array.from(this.messages.values()),
      presence: Array.from(this.presence.values()),
      profiles: Array.from(this.profiles.values()),
      voice: [],
      voiceWorkers: []
    };
  }

  async apply(event: CanonicalEvent): Promise<ApplyResult> {
    const room = event.payload.room as RoomRecord | undefined;
    if (room) this.rooms.set(room.roomId, room);
    if (event.operation === "room.tombstone" && room) this.rooms.set(room.roomId, { ...room, tombstone: true, deletedAt: Date.now() });
    const message = event.payload.message as MessageRecord | undefined;
    if (message) this.messages.set(message.messageId, message);
    const presence = event.payload.presence as PresenceRecord | undefined;
    if (presence) this.presence.set(presence.userId, presence);
    const profile = event.payload.profile as ProfileRecord | undefined;
    if (profile) this.profiles.set(profile.userId, profile);
    this.version = Math.max(this.version, event.version);
    return { ok: true, sourceId: event.sourceId, version: event.version, suppressed: false };
  }

  async subscribe(handler: (event: CanonicalEvent) => Promise<void>): Promise<() => Promise<void>> {
    this.handler = handler;
    await this.flush();
    return async () => { this.handler = null; };
  }

  async close(): Promise<void> {
    this.handler = null;
    this.connected = false;
  }

  disconnect(): void {
    this.connected = false;
  }

  async reconnect(): Promise<void> {
    this.connected = true;
    await this.flush();
  }

  async createRoom(type: RoomType, name: string, options: Record<string, unknown> = {}): Promise<RoomRecord> {
    this.counter += 1;
    const now = Date.now();
    const id = String(this.counter);
    const room: RoomRecord = {
      roomId: "room-" + id,
      discordId: "discord-" + id,
      zellousId: "zellous-" + id,
      serverId: this.serverId,
      guildId: this.guildId,
      type,
      parentId: (options.parentId as string | null) ?? null,
      position: (options.position as number) ?? this.counter - 1,
      name,
      topic: (options.topic as string | null) ?? null,
      discordType: null,
      categoryId: (options.categoryId as string | null) ?? null,
      channelHash: "hash-" + id,
      nsfw: false,
      bitrate: null,
      userLimit: null,
      rateLimitPerUser: null,
      permissionOverwrites: [],
      archived: false,
      locked: false,
      autoArchiveDuration: null,
      invitable: null,
      contentVersion: 1,
      tombstone: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    };
    this.rooms.set(room.roomId, room);
    await this.emit(this.eventForRoom(room, "room.create"));
    return room;
  }

  async renameRoom(roomId: string, name: string): Promise<RoomRecord> {
    const room = this.mutateRoom(roomId, { name });
    await this.emit(this.eventForRoom(room, "room.rename"));
    return room;
  }

  async reorderRoom(roomId: string, position: number): Promise<RoomRecord> {
    const room = this.mutateRoom(roomId, { position });
    await this.emit(this.eventForRoom(room, "room.reorder"));
    return room;
  }

  async reparentRoom(roomId: string, parentId: string | null): Promise<RoomRecord> {
    const room = this.mutateRoom(roomId, { parentId });
    await this.emit(this.eventForRoom(room, "room.reparent"));
    return room;
  }

  async archiveRoom(roomId: string, archived: boolean): Promise<RoomRecord> {
    const room = this.mutateRoom(roomId, { archived });
    await this.emit(this.eventForRoom(room, "room.archive"));
    return room;
  }

  async deleteRoom(roomId: string): Promise<RoomRecord> {
    const room = this.mutateRoom(roomId, { tombstone: true, deletedAt: Date.now() });
    await this.emit(this.eventForRoom(room, "room.delete"));
    return room;
  }

  async createMessage(roomId: string, content: string, options: Record<string, unknown> = {}): Promise<MessageRecord> {
    const now = Date.now();
    const id = "message-" + String(this.messages.size + 1);
    const message: MessageRecord = {
      messageId: id,
      discordId: "discord-" + id,
      zellousEventId: "zellous-" + id,
      roomId,
      author: bridgeActor(this.source),
      content,
      createdAt: now,
      editedAt: null,
      replyTo: (options.replyTo as string | null) ?? null,
      mentions: [],
      attachments: (options.attachments as MessageRecord["attachments"]) ?? [],
      reactions: [],
      previews: [],
      announcement: (options.announcement as boolean) ?? false,
      correctionOf: (options.correctionOf as string | null) ?? null,
      deleted: false,
      contentVersion: 1
    };
    this.messages.set(id, message);
    await this.emit(this.eventForMessage(message, options.correctionOf ? "message.correction" : "message.create"));
    return message;
  }

  async addReaction(messageId: string, emoji: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.reactions.push({ messageId, emoji, userId: "user-1", source: this.source, createdAt: Date.now(), removedAt: null });
    await this.emit(this.eventForMessage(message, "message.reaction"));
  }

  async correctMessage(messageId: string, content: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.content = content;
    message.contentVersion += 1;
    message.editedAt = Date.now();
    await this.emit(this.eventForMessage(message, "message.correction"));
  }

  async deleteMessage(messageId: string): Promise<void> {
    const message = this.messages.get(messageId);
    if (!message) return;
    message.deleted = true;
    message.contentVersion += 1;
    await this.emit(this.eventForMessage(message, "message.delete"));
  }

  async setTyping(userId: string): Promise<void> {
    await this.emit(this.basicEvent("message.typing", userId, { typing: { userId, at: Date.now() } }));
  }

  async setPresence(presence: PresenceRecord): Promise<void> {
    this.presence.set(presence.userId, presence);
    await this.emit(this.basicEvent("presence.update", presence.userId, { presence }));
  }

  async setProfile(profile: ProfileRecord): Promise<void> {
    this.profiles.set(profile.userId, profile);
    await this.emit(this.basicEvent("profile.update", profile.userId, { profile }));
  }

  room(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }

  message(messageId: string): MessageRecord | undefined {
    return this.messages.get(messageId);
  }

  liveRooms(): RoomRecord[] {
    return Array.from(this.rooms.values()).filter((room) => !room.tombstone);
  }

  private mutateRoom(roomId: string, patch: Partial<RoomRecord>): RoomRecord {
    const current = this.rooms.get(roomId);
    if (!current) throw new Error("unknown room " + roomId);
    const room = { ...current, ...patch, contentVersion: current.contentVersion + 1, updatedAt: Date.now() };
    this.rooms.set(roomId, room);
    return room;
  }

  private eventForRoom(room: RoomRecord, operation: Operation): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: this.source === "discord" ? room.discordId ?? room.roomId : room.zellousId ?? room.roomId,
      operation,
      version: room.contentVersion,
      occurredAt: Date.now(),
      actor: bridgeActor(this.source),
      room: roomRef(room),
      payload: { room },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private eventForMessage(message: MessageRecord, operation: Operation): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: this.source === "discord" ? message.discordId ?? message.messageId : message.zellousEventId ?? message.messageId,
      operation,
      version: message.contentVersion,
      occurredAt: Date.now(),
      actor: bridgeActor(this.source),
      room: null,
      payload: { message },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private basicEvent(operation: Operation, sourceId: string, payload: Record<string, unknown>): CanonicalEvent {
    this.version += 1;
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId,
      operation,
      version: this.version,
      occurredAt: Date.now(),
      actor: bridgeActor(this.source),
      room: null,
      payload,
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private async emit(event: CanonicalEvent): Promise<void> {
    if (!this.connected || !this.handler) {
      this.pending.push(event);
      return;
    }
    await this.handler(event);
  }

  private async flush(): Promise<void> {
    while (this.pending.length > 0 && this.handler && this.connected) {
      const event = this.pending.shift();
      if (event) await this.handler(event);
    }
  }
}