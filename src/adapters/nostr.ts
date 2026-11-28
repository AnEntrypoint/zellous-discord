import { createCanonicalEvent } from "../canonical.js";
import { channelHash } from "../nostr.js";
import { finalizeEvent } from "nostr-tools/pure";
import type { MappingStore } from "../mapping.js";
import type { BridgeEchoStore } from "../sync/echo.js";
import type { MessageRecord } from "../types.js";
import type { Config } from "../config.js";
import type { Logger } from "../logger.js";
import { mapZellousChannelToRoom, roomToZellousChannel, type ZellousChannelLike } from "../mappers.js";
import { createNodeWireweave } from "../wireweave-node.js";
import type { AdapterSnapshot, ApplyResult, BridgeAdapter, CanonicalEvent, RoomRecord, Source } from "../types.js";
import { voiceBridgePubkey } from "../voice/zellous.js";
import { VoicePresenceTracker, zellousVoiceRoomId, type PresenceTransition, type VoiceRoomRef } from "../voice/presence.js";
import { attributionTag, BRIDGE_TAG, channelRoot, discordMessageKey, discordProfileEvent, resolveZellousMessage, rootChannelMap } from "../live/source.js";

export class NostrAdapter implements BridgeAdapter {
  readonly source: Source = "zellous";
  private readonly ww: any;
  private listeners: Array<() => void> = [];

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger, private readonly mapping: MappingStore, private readonly echo: BridgeEchoStore) {
    this.ww = createNodeWireweave(config);
    this.ww.channels.load(this.serverId, () => {});
    void this.ww.servers.switchTo(this.serverId);
  }

  get publicKey(): string {
    return String(this.ww.auth.pubkey);
  }

  async snapshot(): Promise<AdapterSnapshot> {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 1000);
      const done = () => { clearTimeout(timer); resolve(); };
      this.ww.channels.addEventListener("updated", done, { once: true });
      this.ww.channels.load(this.serverId, done);
    });
    const channels = (this.ww.channels.channels ?? []) as ZellousChannelLike[];
    const rooms = channels.map((channel) => mapZellousChannelToRoom(channel, this.serverId, this.config.discordGuildId));
    return { source: this.source, version: Date.now(), rooms, messages: [], presence: [], profiles: [], voice: [], voiceWorkers: [] };
  }

  async apply(event: CanonicalEvent): Promise<ApplyResult> {
    const room = event.payload.room as RoomRecord | undefined;
    if (event.operation === "room.create" || event.operation === "room.upsert") {
      if (room) {
        const existing = (this.ww.channels.channels ?? []).find((channel: any) => channel.id === room.zellousId || channel.name === room.name);
        if (existing) await this.ww.channels.update(existing.id, roomToZellousChannel({ ...room, zellousId: existing.id }));
        else await this.ww.channels.create(room.name, room.type, room.categoryId ?? "general", { parentChannelId: room.parentId, ...roomToZellousChannel(room) });
      }
    } else if (event.operation === "room.rename") {
      if (room?.zellousId) await this.ww.channels.rename(room.zellousId, room.name);
    } else if (event.operation === "room.reorder" || event.operation === "room.reparent" || event.operation === "room.archive") {
      if (room?.zellousId) await this.ww.channels.update(room.zellousId, roomToZellousChannel(room));
    } else if (event.operation === "room.delete" || event.operation === "room.tombstone") {
      if (room?.zellousId) await this.ww.channels.remove(room.zellousId);
    } else if (event.operation === "message.create" || event.operation === "message.correction") {
      const message = event.payload.message as MessageRecord | undefined;
      if (message?.content) await this.publishMessage(message);
    } else if (event.operation === "message.delete") {
      const message = event.payload.message as { zellousEventId?: string } | undefined;
      if (message?.zellousEventId) await this.ww.chat.deleteMessage(message.zellousEventId);
    } else if (event.operation === "message.reaction") {
      const message = event.payload.message as { zellousEventId?: string; author?: { bridgePubkey?: string }; reactions?: Array<{ emoji: string }> } | undefined;
      const emoji = message?.reactions?.at(-1)?.emoji ?? "+";
      if (message?.zellousEventId) await this.ww.reactions.react(message.zellousEventId, message.author?.bridgePubkey ?? "", emoji);
    } else if (event.operation === "message.typing") {
      await this.ww.chat.sendTyping();
    } else if (event.operation === "presence.update") {
      const presence = event.payload.presence as { status?: string; custom?: string } | undefined;
      if (presence?.status) await this.ww.presence.set(presence.status, presence.custom ?? "");
    } else if (event.operation === "profile.update") {
      const profile = event.payload.profile as { name?: string; avatarUrl?: string } | undefined;
      if (profile?.name) await this.ww.chat.updateProfile(this.ww.auth.pubkey, { name: profile.name, picture: profile.avatarUrl ?? "" });
    }
    return { ok: true, sourceId: event.sourceId, version: event.version, suppressed: false };
  }

  async subscribe(handler: (event: CanonicalEvent) => Promise<void>): Promise<() => Promise<void>> {
    const attach = (target: any, name: string, make: (detail: any) => CanonicalEvent) => {
      const listener = async (event: any) => { await handler(make(event.detail ?? event)); };
      target.addEventListener(name, listener);
      this.listeners.push(() => target.removeEventListener(name, listener));
    };
    attach(this.ww.channels, "updated", (detail) => this.roomEvent(detail, "room.upsert"));
    this.ww.pool.subscribe("zdb-chat-" + this.serverId, this.chatFilters(), (event: any) => { void handler(this.messageEvent(event, "message.create")); });
    attach(this.ww.chat, "typing", (detail) => this.sideEvent("message.typing", detail));
    attach(this.ww.presence, "updated", (detail) => this.sideEvent("presence.update", detail));
    attach(this.ww.reactions, "updated", (detail) => this.sideEvent("message.reaction", detail));
    const stopVoice = this.watchVoicePresence(handler);
    return async () => {
      stopVoice();
      for (const remove of this.listeners) remove();
      this.listeners = [];
    };
  }

  private voiceRooms(): VoiceRoomRef[] {
    return this.mapping.allRooms().filter((room) => room.type === "voice" && /^[0-9]{17,20}$/.test(String(room.discordId ?? "")) && room.name).map((room) => ({ roomId: zellousVoiceRoomId(this.serverId, room.name), channelName: room.name, discordId: String(room.discordId) }));
  }

  private voiceEvent(transition: PresenceTransition): CanonicalEvent {
    const userId = "zellous:" + transition.pubkey;
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: userId,
      operation: transition.kind === "join" ? "voice.join" : "voice.leave",
      version: Date.now(),
      occurredAt: Date.now(),
      actor: { source: this.source, sourceUserId: transition.pubkey, bridgePubkey: this.publicKey, displayName: transition.pubkey.slice(0, 8), avatarUrl: null },
      room: null,
      payload: { voice: { userId, guildId: this.config.discordGuildId, channelId: transition.kind === "join" ? transition.room.discordId : null, bot: false, muted: false, deafened: false, speaking: false } },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private watchVoicePresence(handler: (event: CanonicalEvent) => Promise<void>): () => void {
    const tracker = new VoicePresenceTracker();
    const timers: NodeJS.Timeout[] = [];
    const emit = (transition: PresenceTransition | null) => { if (transition) void handler(this.voiceEvent(transition)); };
    const attach = (attempt: number) => {
      const rooms = this.voiceRooms();
      if (rooms.length === 0) {
        if (attempt < 12) timers.push(setTimeout(() => attach(attempt + 1), 10000));
        return;
      }
      const byDTag = new Map(rooms.map((room) => ["zellous-voice:" + room.roomId, room]));
      this.ww.pool.subscribe("zdb-voice-" + this.serverId, [{ kinds: [30078], "#d": [...byDTag.keys()], since: Math.floor(Date.now() / 1000) - 60 }], (event: any) => {
        const dTag = (event.tags ?? []).find((tag: string[]) => tag[0] === "d")?.[1];
        const room = byDTag.get(String(dTag));
        if (!room) return;
        let data: { action?: string; ts?: number; bridge?: boolean } = {};
        try { data = JSON.parse(event.content); } catch { return; }
        if (data.bridge === true || String(event.pubkey) === voiceBridgePubkey(this.config)) return;
        emit(tracker.observe(room, String(event.pubkey), String(data.action ?? ""), Number(data.ts ?? 0), Date.now()));
      });
      this.logger.info("zellous voice presence watched", { rooms: rooms.length });
    };
    attach(0);
    timers.push(setInterval(() => { for (const transition of tracker.sweep(Date.now())) emit(transition); }, 10000));
    return () => { for (const timer of timers) { clearTimeout(timer); clearInterval(timer); } };
  }

  async close(): Promise<void> {
    for (const remove of this.listeners) remove();
    this.listeners = [];
    this.ww.pool.disconnect();
  }

  private roomEvent(detail: any, operation: "room.upsert"): CanonicalEvent {
    const channel = (detail.channels ?? [])[0] as ZellousChannelLike | undefined;
    const room = channel ? mapZellousChannelToRoom(channel, this.serverId, this.config.discordGuildId) : null;
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: room?.zellousId ?? "channels",
      operation,
      version: Date.now(),
      occurredAt: Date.now(),
      actor: { source: this.source, sourceUserId: "bridge", bridgePubkey: this.publicKey, displayName: "bridge", avatarUrl: null },
      room: room ? { roomId: room.roomId, discordId: room.discordId, zellousId: room.zellousId, serverId: room.serverId, guildId: room.guildId, type: room.type, parentId: room.parentId, position: room.position, name: room.name, topic: room.topic } : null,
      payload: { room },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private chatFilters(): any[] {
    const roots = [...rootChannelMap(this.serverId, this.mapping).keys()];
    return [{ kinds: [42], "#e": roots, limit: 200 }];
  }

  private messageEvent(detail: any, operation: "message.create"): CanonicalEvent {
    const raw = detail.message ?? detail.list?.at?.(-1) ?? detail;
    const eventId = String(raw.id ?? "messages");
    const tags = (raw.tags ?? []) as string[][];
    const target = resolveZellousMessage(tags, rootChannelMap(this.serverId, this.mapping), String(raw.pubkey ?? ""));
    if (!target) return this.suppressedEvent(eventId, operation);
    if (this.echo.isZellous(eventId) || tags.some(function(tag) { return tag[0] === "t" && tag[1] === BRIDGE_TAG; })) return this.suppressedEvent(eventId, operation);
    const discordId = target.discordId;
    const username = target.username;
    const zellousChannelId = "room-" + discordId;
    const room = this.mapping.getRoomByDiscordId(discordId);
    const createdAt = Number(raw.created_at ?? Math.floor(Date.now() / 1000)) * 1000;
    const sourceUserId = String(raw.pubkey ?? "");
    const message: MessageRecord = {
      messageId: "message-" + eventId,
      discordId: null,
      zellousEventId: eventId,
      roomId: "room-" + discordId,
      author: { source: this.source, sourceUserId, bridgePubkey: sourceUserId, displayName: username, avatarUrl: null },
      content: String(raw.content ?? ""),
      createdAt,
      editedAt: null,
      replyTo: raw.replyTo?.id ?? null,
      mentions: [],
      attachments: [],
      reactions: [],
      previews: [],
      announcement: false,
      correctionOf: null,
      deleted: false,
      contentVersion: 1
    };
    if (!message.content) return this.suppressedEvent(eventId, operation);
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: eventId,
      operation,
      version: Math.floor(createdAt / 1000),
      occurredAt: createdAt,
      actor: message.author,
      room: { roomId: message.roomId, discordId, zellousId: zellousChannelId, serverId: this.serverId, guildId: this.config.discordGuildId, type: "text", parentId: room?.parentId ?? null, position: room?.position ?? 0, name: room?.name ?? "channel", topic: room?.topic ?? null },
      payload: { message },
      suppressionKey: eventId,
      tracing: [this.source]
    });
  }

  private suppressedEvent(eventId: string, operation: "message.create"): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: eventId,
      operation,
      version: 1,
      occurredAt: Date.now(),
      actor: { source: this.source, sourceUserId: "bridge", bridgePubkey: this.publicKey, displayName: "bridge", avatarUrl: null },
      room: null,
      payload: { suppressed: true },
      suppressionKey: eventId,
      tracing: [this.source]
    });
  }

  private async publishMessage(message: MessageRecord): Promise<void> {
    const discordId = message.roomId.replace("room-", "");
    const root = channelRoot(this.serverId, discordId);
    const username = message.author.displayName || message.author.sourceUserId;
    const secretKey = discordMessageKey(this.config, message.author.sourceUserId || username);
    const profile = discordProfileEvent(secretKey, username);
    const tags: string[][] = [["e", root, "", "root"], ["t", BRIDGE_TAG], attributionTag(username)];
    if (message.author.bridgePubkey) tags.push(["p", message.author.bridgePubkey]);
    const signed = finalizeEvent({ kind: 42, created_at: Math.floor(Date.now() / 1000), tags, content: message.content }, secretKey);
    this.echo.rememberZellous(String(signed.id));
    await Promise.all([this.ww.pool.publish(profile), this.ww.pool.publish(signed)]);
  }

  private sideEvent(operation: "message.typing" | "presence.update" | "message.reaction", detail: any): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: String(detail?.pubkey ?? detail?.targetId ?? operation),
      operation,
      version: Date.now(),
      occurredAt: Date.now(),
      actor: { source: this.source, sourceUserId: "bridge", bridgePubkey: this.publicKey, displayName: "bridge", avatarUrl: null },
      room: null,
      payload: { detail },
      suppressionKey: null,
      tracing: [this.source]
    });
  }
}
