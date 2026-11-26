import { createCanonicalEvent } from "../canonical.js";
import type { Config } from "../config.js";
import type { Logger } from "../logger.js";
import { mapZellousChannelToRoom, roomToZellousChannel, type ZellousChannelLike } from "../mappers.js";
import { createNodeWireweave } from "../wireweave-node.js";
import type { AdapterSnapshot, ApplyResult, BridgeAdapter, CanonicalEvent, RoomRecord, Source } from "../types.js";

export class NostrAdapter implements BridgeAdapter {
  readonly source: Source = "zellous";
  private readonly ww: any;
  private listeners: Array<() => void> = [];

  constructor(private readonly config: Config, private readonly serverId: string, private readonly logger: Logger) {
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
      const message = event.payload.message as { content?: string } | undefined;
      if (message?.content) await this.ww.chat.send(message.content);
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
    attach(this.ww.chat, "messages", (detail) => this.messageEvent(detail, "message.create"));
    attach(this.ww.chat, "typing", (detail) => this.sideEvent("message.typing", detail));
    attach(this.ww.presence, "updated", (detail) => this.sideEvent("presence.update", detail));
    attach(this.ww.reactions, "updated", (detail) => this.sideEvent("message.reaction", detail));
    return async () => {
      for (const remove of this.listeners) remove();
      this.listeners = [];
    };
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

  private messageEvent(detail: any, operation: "message.create"): CanonicalEvent {
    const message = (detail.list ?? [])[0];
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: String(message?.id ?? "messages"),
      operation,
      version: Date.now(),
      occurredAt: Date.now(),
      actor: { source: this.source, sourceUserId: String(message?.userId ?? ""), bridgePubkey: String(message?.userId ?? ""), displayName: "zellous", avatarUrl: null },
      room: null,
      payload: { message },
      suppressionKey: null,
      tracing: [this.source]
    });
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