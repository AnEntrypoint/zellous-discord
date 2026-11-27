export type Source = "discord" | "zellous" | "bridge"
export type RoomType = "category" | "text" | "announcement" | "forum" | "thread" | "stage" | "voice" | "page"
export type Operation =
  | "room.create"
  | "room.rename"
  | "room.reorder"
  | "room.reparent"
  | "room.archive"
  | "room.delete"
  | "room.upsert"
  | "room.tombstone"
  | "message.create"
  | "message.correction"
  | "message.delete"
  | "message.reaction"
  | "message.attachment"
  | "message.typing"
  | "presence.update"
  | "profile.update"
  | "voice.join"
  | "voice.leave"
  | "voice.state"
  | "voice.signal"
  | "voice.frame"
  | "voice.worker"
  | "checkpoint"
  | "suppression"

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface ActorRef {
  source: Source;
  sourceUserId: string;
  bridgePubkey: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface RoomRef {
  roomId: string;
  discordId: string | null;
  zellousId: string | null;
  serverId: string;
  guildId: string;
  type: RoomType;
  parentId: string | null;
  position: number;
  name: string;
  topic: string | null;
}

export interface CanonicalEvent {
  schemaVersion: number;
  eventId: string;
  source: Source;
  sourceId: string;
  operation: Operation;
  version: number;
  idempotencyKey: string;
  occurredAt: number;
  actor: ActorRef;
  room: RoomRef | null;
  payload: Record<string, unknown>;
  suppressionKey: string | null;
  tracing: string[];
}

export interface PermissionOverwrite {
  id: string;
  type: "role" | "member";
  allow: string;
  deny: string;
}

export interface RoomRecord extends RoomRef {
  discordType: number | null;
  categoryId: string | null;
  channelHash: string | null;
  nsfw: boolean;
  bitrate: number | null;
  userLimit: number | null;
  rateLimitPerUser: number | null;
  permissionOverwrites: PermissionOverwrite[];
  archived: boolean;
  locked: boolean;
  autoArchiveDuration: number | null;
  invitable: boolean | null;
  contentVersion: number;
  tombstone: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface AttachmentRecord {
  url: string;
  mime: string;
  size: number | null;
  name: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface ReactionRecord {
  messageId: string;
  emoji: string;
  userId: string;
  source: Source;
  createdAt: number;
  removedAt: number | null;
}

export interface MessageRecord {
  messageId: string;
  discordId: string | null;
  zellousEventId: string | null;
  roomId: string;
  author: ActorRef;
  content: string;
  createdAt: number;
  editedAt: number | null;
  replyTo: string | null;
  mentions: string[];
  attachments: AttachmentRecord[];
  reactions: ReactionRecord[];
  previews: JsonValue[];
  announcement: boolean;
  correctionOf: string | null;
  deleted: boolean;
  contentVersion: number;
}

export interface PresenceRecord {
  userId: string;
  status: "online" | "idle" | "dnd" | "invisible";
  custom: string;
  until: number;
  voiceChannelId: string | null;
  muted: boolean;
  deafened: boolean;
  speaking: boolean;
  lastSeen: number;
}

export interface ProfileRecord {
  userId: string;
  name: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  updatedAt: number;
}

export interface VoiceSignal {
  signalType: "offer" | "answer" | "ice" | "relay";
  sdp: string | null;
  iceCandidate: JsonValue | null;
  fromPubkey: string;
  toPubkey: string;
  roomId: string;
  dTag: string;
  pTag: string;
  rTag: string;
  streamId: string | null;
  src: string | null;
  muteMs: number | null;
  unmuteMs: number | null;
  fragment: boolean;
  clipSpliced: boolean;
  relayed: boolean;
  remoteKeys: string[];
  relays: Record<string, string> | null;
  hub: string | null;
  uplinkClass: number | null;
  presenceLiveMs: number;
  hb: boolean;
  hbAt: number;
  netAt: number;
  jitter: number;
  linkAlive: boolean;
  suspect: boolean;
  seen: number;
  routeTimer: number | null;
  routeFor: string | null;
  myClass: number | null;
  calmAt: number;
  claim: string | null;
  cls: number;
  relayMap: string[];
  relayTxs: string[];
}

export interface VoiceFrame {
  voiceId: string;
  direction: "discord-to-zellous" | "zellous-to-discord";
  opusPayload: string;
  ssrc: number;
  sequence: number;
  timestamp: number;
  sampleRate: 48000;
  channels: 2;
  codec: "opus";
  marker: boolean;
}

export interface VoiceRecord {
  voiceId: string;
  roomId: string;
  discordUserId: string | null;
  zellousPubkey: string | null;
  direction: "discord-to-zellous" | "zellous-to-discord";
  identity: string;
  workerId: string;
  streamId: string;
  ssrc: number | null;
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  connectionQuality: string;
  leave: boolean;
  updatedAt: number;
}

export interface VoiceWorkerRecord {
  workerId: string;
  identity: string;
  direction: "discord-to-zellous" | "zellous-to-discord";
  roomId: string;
  startedAt: number;
  stoppedAt: number | null;
}

export interface LedgerRecord {
  kind: string;
  eventId: string;
  source: Source;
  sourceId: string;
  operation: Operation;
  version: number;
  idempotencyKey: string;
  occurredAt: number;
  payload: Record<string, unknown>;
}

export interface LedgerState {
  seen: Map<string, string>;
  rooms: Map<string, RoomRecord>;
  roomsByDiscordId: Map<string, string>;
  roomsByZellousId: Map<string, string>;
  messages: Map<string, MessageRecord>;
  messagesByDiscordId: Map<string, string>;
  messagesByZellousId: Map<string, string>;
  presence: Map<string, PresenceRecord>;
  profiles: Map<string, ProfileRecord>;
  voice: Map<string, VoiceRecord>;
  voiceWorkers: Map<string, VoiceWorkerRecord>;
  suppressions: Map<string, Record<string, unknown>>;
  identities: Map<string, string>;
  checkpoints: Map<string, number>;
}

export interface AdapterSnapshot {
  source: Source;
  version: number;
  rooms: RoomRecord[];
  messages: MessageRecord[];
  presence: PresenceRecord[];
  profiles: ProfileRecord[];
  voice: VoiceRecord[];
  voiceWorkers: VoiceWorkerRecord[];
}

export interface ApplyResult {
  ok: boolean;
  sourceId: string;
  version: number;
  suppressed: boolean;
}

export interface BridgeAdapter {
  readonly source: Source;
  snapshot(): Promise<AdapterSnapshot>;
  apply(event: CanonicalEvent): Promise<ApplyResult>;
  subscribe(handler: (event: CanonicalEvent) => Promise<void>): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

export interface ReconcileResult {
  roomsCreated: number;
  roomsUpdated: number;
  roomsTombstoned: number;
  messagesCreated: number;
  messagesUpdated: number;
  duplicatesSuppressed: number;
}