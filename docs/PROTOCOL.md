# PROTOCOL.md

This is the exact cross-system event contract for the bridge. Contract version: 1. It is grounded in the sources listed in docs/RESEARCH.md.

## Canonical envelope

Every bridge event uses these fields: schemaVersion, eventId, source, sourceId, operation, version, idempotencyKey, occurredAt, actor, room, payload, suppressionKey, tracing.

schemaVersion is the integer contract version. eventId is the SHA-256 of the canonicalized envelope without eventId and idempotencyKey. source is discord, zellous or bridge. sourceId is the immutable source object id. operation is one of room.create, room.rename, room.reorder, room.reparent, room.archive, room.delete, room.upsert, room.tombstone, message.create, message.correction, message.delete, message.reaction, message.attachment, message.typing, presence.update, profile.update, voice.join, voice.leave, voice.state, voice.signal, voice.frame, voice.worker, checkpoint, suppression. version is a monotonic per-object integer. idempotencyKey is SHA-256 of source, sourceId, operation and version. occurredAt is Unix milliseconds. actor is an identity reference. room is a room reference or null. payload is an operation-specific JSON object. suppressionKey names the event being echoed or null. tracing is an ordered list of adapter names.

Duplicate idempotencyKey values are not written twice. A replay after restart reconstructs rooms, messages, presence, profiles, voice, voice workers, suppressions, identities and checkpoints from the append-only JSONL ledger. Suppression records bind an eventId to targetSource and targetId. A bridge adapter checks the suppression ledger before emitting an event that it just applied.

## Room and channel fields

Room fields: roomId, discordId, zellousId, serverId, guildId, type, parentId, position, name, topic, discordType, categoryId, channelHash, nsfw, bitrate, userLimit, rateLimitPerUser, permissionOverwrites, archived, locked, autoArchiveDuration, invitable, contentVersion, tombstone, createdAt, updatedAt, deletedAt.

roomId is the bridge primary key. discordId and zellousId are the two native ids. serverId is the derived zellous server id pubkey:dTag. guildId is 367741339393327104. type is category, text, announcement, forum, thread, stage or voice. parentId is the native parent channel or thread host. position is the sibling order. name and topic come from the source. discordType is the numeric Discord channel type. categoryId is the zellous category id. channelHash is SHA-256 of serverId plus colon plus the zellous channel id. nsfw, bitrate, userLimit, rateLimitPerUser and permissionOverwrites preserve Discord metadata. archived, locked, autoArchiveDuration and invitable preserve thread and stage metadata. contentVersion increases on every mutation. tombstone is terminal for delete-and-recreate. createdAt, updatedAt and deletedAt are Unix milliseconds.

Discord numeric type mapping: 0 to text, 2 to voice, 4 to category, 5 to announcement, 10 to thread, 11 to thread, 12 to thread, 13 to stage, 14 to category, 15 to forum, 16 to forum. Reverse mapping: category to 4, text to 0, announcement to 5, forum to 15, thread to 11 or 12, stage to 13, voice to 2.

zellous channel state is a replaceable kind 30078 event authored by the bridge server owner with d tag zellous-channels:serverId. Its content is JSON with channels and categories arrays. Server metadata is replaceable kind 34550 with d, name and color tags. A server tombstone adds deleted with value 1. Kind 42 messages use the channelHash as the e root tag. Source: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/channels.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/channel-hex.js

## Message, reaction, attachment, correction, typing, presence and profile fields

Message fields: messageId, discordId, zellousEventId, roomId, author, content, createdAt, editedAt, replyTo, mentions, attachments, reactions, previews, announcement, correctionOf, deleted, contentVersion, typing, presence, profile.

messageId is the bridge primary key. discordId and zellousEventId are native ids. roomId binds the message to a room. author is an actor reference. content is UTF-8 text. createdAt and editedAt are Unix milliseconds. replyTo is a messageId. mentions is a list of actor ids. attachments is a list of url, mime, size, name, width, height and durationMs. reactions is a list of messageId, emoji, userId, source, createdAt and removedAt. previews is a list of link metadata. announcement marks an announcement post. correctionOf points to an immutable Nostr event id. deleted is best-effort only. contentVersion increases per correction. typing, presence and profile identify the side-channel records associated with the message stream.

Nostr kind 42 messages are immutable. Discord edits and deletes map to message.correction and message.delete envelopes with correctionOf, never to an in-place mutation of zellousEventId. A correction publishes a new kind 42 event carrying an explicit correction marker in content and a t bridge-correction tag. A best-effort kind 5 event carries an e tag naming the original event. Reactions are kind 7 events with e, k and p tags. Typing is kind 20042 with the channel e root tag, a 6000 ms TTL and a 3000 ms throttle. Presence is replaceable kind 30078 with d tag zellous-presence:status and content carrying status, custom and until. Attachments are Blossom URLs embedded in kind 42 content with an imeta tag. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/chat.js, https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/reactions.js, https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/presence.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/media.js

Presence fields: userId, status, custom, until, voiceChannelId, muted, deafened, speaking, lastSeen, online, idle, dnd, invisible, offline.

status is one of online, idle, dnd, invisible or offline. custom is a status string. until is a Unix millisecond expiry. voiceChannelId, muted, deafened, speaking and lastSeen are bridge-side voice presence extensions. online, idle, dnd, invisible and offline are the status literals used by the mapper.

## Voice fields

Voice fields: voiceId, roomId, discordUserId, zellousPubkey, direction, identity, workerId, streamId, ssrc, speaking, muted, deafened, connectionQuality, leave, signalType, sdp, iceCandidate, fromPubkey, toPubkey, dTag, pTag, rTag, opusPayload, sequence, timestamp, sampleRate, channels, codec, marker, action, channel, server, ts, rttScores, capScores, reflexive, uplinkKbps.

voiceId is one stable identity stream. roomId binds to a voice room. discordUserId and zellousPubkey name the two endpoints. direction is discord-to-zellous or zellous-to-discord. identity is a persistent derived Nostr identity. workerId and streamId identify one audio worker and one stream. ssrc, sequence, timestamp, sampleRate, channels, codec, marker and opusPayload describe one Opus RTP frame. sampleRate is always 48000. channels is always 2. codec is always opus. speaking, muted, deafened, connectionQuality and leave are per-user state.

signalType is offer, answer or ice. sdp carries an offer or answer. iceCandidate carries one candidate or a candidate array. fromPubkey, toPubkey, dTag, pTag and rTag reproduce wireweave signaling tags. action, channel, server, ts, rttScores, capScores, reflexive and uplinkKbps reproduce wireweave voice presence content and tags. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/voice.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/voice-room-id.js

Voice room id is zellous plus the first 16 hex characters of SHA-256 of serverId plus colon plus voice plus colon plus channel name. Voice presence uses replaceable kind 30078 with d tag zellous-voice:roomId and action, channel and server tags. WebRTC signals use replaceable kind 30078 with d tag zellous-rtc:roomId:fromPubkey:toPubkey:type:sequence, p tag toPubkey and r tag roomId. Content is JSON with type and data.

Discord voice uses Opus at 48000 Hz with two channels, Gateway voice state updates, voice WebSocket version 8, UDP transport, a 32 byte secret_key, nonzero speaking bitmask and DAVE support. Distinct simultaneous Discord voice identities require distinct bot users, declared as DISCORD_VOICE_TOKENS. Sources: https://docs.discord.com/developers/topics/voice-connections, https://docs.discord.com/developers/events/gateway, https://unpkg.com/@discordjs/voice@0.19.2/README.md, https://discord.js.org/docs/packages/voice/main/VoiceReceiver:Class and https://unpkg.com/werift@0.28.0/README.md

## Operations and convergence

room.create, room.rename, room.reorder, room.reparent, room.archive and room.delete carry the full room record. A delete is a tombstone, not a row removal. A later object with the same native name and a newer version creates a new roomId and never resurrects a tombstone. Out-of-order replay compares contentVersion and ignores older versions. On startup and after either side reconnects, the engine reads both snapshots, creates missing records, updates newer metadata and ordering, tombstones missing records on the opposite side, and records checkpoints. Delete-and-recreate, relay disconnect, Discord reconnect and duplicate delivery converge because every mutation carries an idempotencyKey and every emitted mutation records a suppression entry.

Messages, reactions, attachments, corrections, deletions, typing, presence and profiles use the same envelope and suppression rules. Echo detection uses eventId, idempotencyKey, source and native ids. A duplicate canonical event never creates a second room or message.

## Credential and secret contract

DISCORD_TOKEN is the control bot token. DISCORD_VOICE_TOKENS is a comma-separated pool of distinct voice bot tokens. BRIDGE_PRIVATE_KEY_HEX is optional; when absent the service persists a generated seed in the ignored state directory at mode 600. Secret values are wrapped in SecretString, redacted by the logger, excluded from fixtures and reports, and scanned in the worktree and git history.