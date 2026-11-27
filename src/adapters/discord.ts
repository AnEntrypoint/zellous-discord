import { Client, Events, GatewayIntentBits } from "discord.js";
import { createCanonicalEvent } from "../canonical.js";
import type { Config } from "../config.js";
import type { Logger } from "../logger.js";
import { mapDiscordChannelToRoom, mapDiscordMessageToMessage, mapDiscordPresenceToPresence, mapGatewayMessageToDiscordLike, mapMessageToDiscordPayload, roomToDiscordCreate, roomToDiscordPatch, stableDiscordVersion, type DiscordChannelLike } from "../mappers.js";
import type { MappingStore } from "../mapping.js";
import type { BridgeEchoStore } from "../sync/echo.js";
import type { AdapterSnapshot, ApplyResult, BridgeAdapter, CanonicalEvent, MessageRecord, RoomRecord, Source } from "../types.js";

export const BASE_INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMessageTyping, GatewayIntentBits.GuildVoiceStates];
export const PRIVILEGED_INTENTS = [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildPresences, GatewayIntentBits.GuildMembers];

export function gatewayIntents(config: Config): number[] {
  return config.privilegedIntentsEnabled ? [...BASE_INTENTS, ...PRIVILEGED_INTENTS] : [...BASE_INTENTS];
}

export function degradedFeatures(config: Config, readiness?: { complete: boolean }): string[] {
  const features: string[] = [];
  if (!config.privilegedIntentsEnabled) features.push("message-content", "presence", "member-list");
  const complete = readiness ? readiness.complete : config.voiceTokens.length >= 2 && config.privilegedIntentsEnabled;
  if (!complete) features.push("per-user-voice-reflection");
  return features;
}

function messageChannelId(message: MessageRecord | undefined, mapping?: MappingStore): string {
  const roomId = String(message?.roomId ?? "");
  const zellousId = roomId.startsWith("room-") ? roomId : null;
  const mapped = zellousId ? mapping?.getRoomByZellousId(zellousId) : undefined;
  return String(mapped?.discordId ?? roomId.replace("room-", ""));
}

function bridgeActor() {
  return { source: "discord" as Source, sourceUserId: "bridge", bridgePubkey: null, displayName: "bridge", avatarUrl: null };
}

async function discordRequest(config: Config, method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch("https://discord.com/api/v10" + path, {
    method,
    headers: { Authorization: "Bot " + config.discordToken.reveal(), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Discord REST failed with status " + String(response.status));
  return response.status === 204 ? null : await response.json();
}

export class DiscordAdapter implements BridgeAdapter {
  readonly source: Source = "discord";
  private client: Client | null = null;

  constructor(private readonly config: Config, private readonly logger: Logger, private readonly mapping: MappingStore, private readonly echo: BridgeEchoStore) {}

  async snapshot(): Promise<AdapterSnapshot> {
    const channels = await discordRequest(this.config, "GET", "/guilds/" + this.config.discordGuildId + "/channels") as DiscordChannelLike[];
    const rooms = channels.map((channel) => mapDiscordChannelToRoom(channel, this.config.zellousServerId, this.config.discordGuildId));
    return { source: this.source, version: Date.now(), rooms, messages: [], presence: [], profiles: [], voice: [], voiceWorkers: [] };
  }

  async apply(event: CanonicalEvent): Promise<ApplyResult> {
    const room = event.payload.room as RoomRecord | undefined;
    const message = event.payload.message as MessageRecord | undefined;
    if (event.operation === "room.create" || event.operation === "room.upsert") {
      if (room && process.env.ZDBRIDGE_READ_ONLY !== "1") {
        const existing = (await discordRequest(this.config, "GET", "/guilds/" + this.config.discordGuildId + "/channels") as DiscordChannelLike[]).find(function(channel) { return channel.name === room.name; });
        if (existing) await discordRequest(this.config, "PATCH", "/channels/" + existing.id, roomToDiscordPatch(room));
        else await discordRequest(this.config, "POST", "/guilds/" + this.config.discordGuildId + "/channels", roomToDiscordCreate(room));
      }
    } else if (event.operation.startsWith("room.")) {
      if (room && room.discordId) await discordRequest(this.config, "PATCH", "/channels/" + room.discordId, roomToDiscordPatch(room));
      if (event.operation === "room.delete" || event.operation === "room.tombstone") {
        if (room && room.discordId) await discordRequest(this.config, "DELETE", "/channels/" + room.discordId);
      }
    } else if (event.operation === "message.create" || event.operation === "message.correction" || event.operation === "message.attachment") {
      if (message) {
        const nonce = "zdb-" + (message.zellousEventId ?? event.sourceId);
        this.echo.rememberNonce(nonce);
        const created = await discordRequest(this.config, "POST", "/channels/" + messageChannelId(message, this.mapping) + "/messages", { ...mapMessageToDiscordPayload(message), nonce }) as { id?: string } | null;
        if (created?.id) this.echo.rememberDiscord(String(created.id));
      }
    } else if (event.operation === "message.reaction") {
      const reactions = message?.reactions ?? [];
      for (const reaction of reactions) await discordRequest(this.config, "PUT", "/channels/" + messageChannelId(message, this.mapping) + "/messages/" + reaction.messageId + "/reactions/" + encodeURIComponent(reaction.emoji) + "/@me");
    } else if (event.operation === "message.delete") {
      if (message?.discordId) await discordRequest(this.config, "DELETE", "/channels/" + messageChannelId(message, this.mapping) + "/messages/" + message.discordId);
    } else if (event.operation === "message.typing") {
      if (message) await discordRequest(this.config, "POST", "/channels/" + messageChannelId(message, this.mapping) + "/typing");
    }
    return { ok: true, sourceId: event.sourceId, version: event.version, suppressed: false };
  }

  async subscribe(handler: (event: CanonicalEvent) => Promise<void>): Promise<() => Promise<void>> {
    const client = new Client({ intents: gatewayIntents(this.config) });
    this.client = client;
    let ready = false;
    const publish = async (event: CanonicalEvent) => {
      if (!ready) return;
      try { await handler(event); } catch (error) { this.logger.error("discord event degraded", { operation: event.operation, message: error instanceof Error ? error.message : String(error) }); }
    };
    client.on(Events.ClientReady, () => { ready = true; });
    client.on(Events.ChannelCreate, async (channel: any) => { await publish(this.channelEvent(channel, "room.create")); });
    client.on(Events.ChannelUpdate, async (channel: any) => { await publish(this.channelEvent(channel, "room.rename")); });
    client.on(Events.ChannelDelete, async (channel: any) => { await publish(this.channelEvent(channel, "room.delete")); });
    client.on(Events.MessageCreate, async (message: any) => { await this.publishGatewayMessage(message, "message.create", publish); });
    client.on(Events.MessageUpdate, async (message: any) => { await this.publishGatewayMessage(message, "message.correction", publish); });
    client.on(Events.MessageDelete, async (message: any) => { await publish(this.messageEvent(message, "message.delete")); });
    client.on(Events.MessageReactionAdd, async (reaction: any) => { await publish(this.reactionEvent(reaction, "message.reaction")); });
    client.on(Events.TypingStart, async (typing: any) => { await publish(this.typingEvent(typing)); });
    client.on(Events.PresenceUpdate, async (presence: any) => { await publish(this.presenceEvent(presence)); });
    client.on(Events.VoiceStateUpdate, async (state: any) => { await publish(this.voiceEvent(state)); });
    client.on(Events.Error, async (error: Error) => { this.logger.error("discord gateway error", { message: error.message }); });
    await client.login(this.config.discordToken.reveal());
    if (client.isReady()) ready = true;
    return async () => { client.destroy(); this.client = null; };
  }

  async close(): Promise<void> {
    this.client?.destroy();
    this.client = null;
  }

  private channelEvent(channel: any, operation: "room.create" | "room.rename" | "room.delete"): CanonicalEvent {
    const room = mapDiscordChannelToRoom(channel as DiscordChannelLike, this.config.zellousServerId, this.config.discordGuildId);
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: channel.id,
      operation,
      version: Date.now(),
      occurredAt: Date.now(),
      actor: bridgeActor(),
      room: { roomId: room.roomId, discordId: room.discordId, zellousId: room.zellousId, serverId: room.serverId, guildId: room.guildId, type: room.type, parentId: room.parentId, position: room.position, name: room.name, topic: room.topic },
      payload: { room },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private isBridgeEcho(message: any): boolean {
    const id = String(message.id ?? "");
    const nonce = String(message.nonce ?? "");
    return this.echo.isDiscord(id) || this.echo.isNonce(nonce) || nonce.startsWith("zdb-");
  }

  private async fetchMessageContent(channelId: string, messageId: string): Promise<string> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const fetched = await discordRequest(this.config, "GET", "/channels/" + channelId + "/messages/" + messageId) as { content?: string } | null;
      const content = String(fetched?.content ?? "");
      if (content) return content;
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
    }
    return "";
  }

  private async publishGatewayMessage(message: any, operation: "message.create" | "message.correction", publish: (event: CanonicalEvent) => Promise<void>): Promise<void> {
    const id = String(message.id ?? "");
    if (!id || this.isBridgeEcho(message) || this.echo.isDiscordSeen(id)) return;
    const channelId = String(message.channelId ?? message.channel?.id ?? "");
    const content = String(message.content ?? "") || await this.fetchMessageContent(channelId, id);
    if (!content) return;
    this.echo.rememberDiscordSeen(id);
    await publish(this.messageEvent({ ...message, id, channelId, content }, operation));
  }

  private messageEvent(message: any, operation: "message.create" | "message.correction" | "message.delete"): CanonicalEvent {
    const channelId = String(message.channelId ?? message.channel?.id ?? "");
    const room = mapDiscordChannelToRoom({ id: channelId, type: 0, name: "channel" }, this.config.zellousServerId, this.config.discordGuildId);
    const mapped = mapDiscordMessageToMessage(mapGatewayMessageToDiscordLike(message), room, bridgeActor());
    const nativeId = String(message.id);
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: nativeId,
      operation,
      version: stableDiscordVersion(nativeId),
      occurredAt: mapped.createdAt,
      actor: bridgeActor(),
      room: null,
      payload: { message: mapped },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private reactionEvent(reaction: any, operation: "message.reaction"): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: String(reaction.message?.id ?? ""),
      operation,
      version: Date.now(),
      occurredAt: Date.now(),
      actor: bridgeActor(),
      room: null,
      payload: { reaction: { emoji: String(reaction.emoji?.name ?? reaction.emoji?.id ?? ""), userId: String(reaction.users?.last()?.id ?? "") } },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private typingEvent(typing: any): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: String(typing.channel?.id ?? ""),
      operation: "message.typing",
      version: Date.now(),
      occurredAt: Date.now(),
      actor: bridgeActor(),
      room: null,
      payload: { typing: { userId: String(typing.user?.id ?? ""), channelId: String(typing.channel?.id ?? "") } },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private presenceEvent(presence: any): CanonicalEvent {
    const mapped = mapDiscordPresenceToPresence(String(presence.userId ?? presence.user?.id ?? ""), String(presence.status ?? "online"), presence.voiceChannelId ?? null, Boolean(presence.mute), Boolean(presence.deaf));
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: mapped.userId,
      operation: "presence.update",
      version: Date.now(),
      occurredAt: Date.now(),
      actor: bridgeActor(),
      room: null,
      payload: { presence: mapped },
      suppressionKey: null,
      tracing: [this.source]
    });
  }

  private voiceEvent(state: any): CanonicalEvent {
    return createCanonicalEvent({
      schemaVersion: 1,
      source: this.source,
      sourceId: String(state.id ?? state.member?.user?.id ?? ""),
      operation: state.channelId ? "voice.join" : "voice.leave",
      version: Date.now(),
      occurredAt: Date.now(),
      actor: bridgeActor(),
      room: null,
      payload: { voice: { channelId: state.channelId ?? null, muted: Boolean(state.mute), deafened: Boolean(state.deaf), speaking: false } },
      suppressionKey: null,
      tracing: [this.source]
    });
  }
}