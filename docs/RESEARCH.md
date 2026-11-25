# RESEARCH.md

Recorded on 2026-11-25. All facts were read again for Stage 1.

## zellous and pinned wireweave

The zellous app is a static browser application with no backend or account service. Identity is a Nostr keypair, relays and localStorage hold state, and the protocol implementation is wireweave loaded from a pinned CDN commit. Sources: /config/workspace/zellous/README.md lines 1 to 5 and 22 to 38, /config/workspace/zellous/AGENTS.md line 7, /config/workspace/zellous/docs/nostr-chat/index.html line 29.

Pinned wireweave commit: 4508d66ff4cd3fde31959cc8b998810f367be321. CDN entry: https://cdn.jsdelivr.net/gh/AnEntrypoint/wireweave@4508d66ff4cd3fde31959cc8b998810f367be321/src/index.js

Room hash: SHA-256 of serverId plus colon plus channelId. Voice room id: zellous plus the first 16 hex characters of SHA-256 of serverId plus colon plus voice plus colon plus channel name. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/channel-hex.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/voice-room-id.js

Channels are a replaceable kind 30078 event authored by the server owner with d tag zellous-channels:serverId. Content is JSON with channels and categories. Channel records carry id, name, type, categoryId, position and optional parentChannelId. Category records carry id, name and position. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/channels.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/dtag.js

Server metadata is a replaceable kind 34550 event with d, name and color tags. A tombstone adds deleted with value 1. The server id is pubkey:dTag. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/servers.js and /config/workspace/zellous/AGENTS.md line 174.

Chat messages are immutable kind 42 events with an e root tag equal to the channel hash, optional e reply, t announcement, preview and imeta tags. Typing is kind 20042 with the same e tag, a 6000 ms TTL and a 3000 ms throttle. Reactions are kind 7 with e and p tags. Deletions are best-effort kind 5 events with an e tag. Presence is replaceable kind 30078 with d tag zellous-presence:status and content JSON carrying status, custom and until. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/chat.js, https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/reactions.js, https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/presence.js and https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/media.js

Voice presence is replaceable kind 30078 with d tag zellous-voice:roomId plus action, channel and server tags. Content JSON carries action, name, channel, muted, ts, rttScores, capScores, reflexive and uplinkKbps. WebRTC signals are replaceable kind 30078 with d tag zellous-rtc:roomId:fromPubkey:toPubkey:type:sequence and p and r tags. Content JSON carries type and data for offer, answer and ice. Sources: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/voice.js lines 595 to 607 and 711 to 713 and 884 to 931.

Default relays are wss://relay.primal.net, wss://nos.lol, wss://offchain.pub, wss://nostr-pub.wellorder.net, wss://relay.snort.social and wss://relay.damus.io. Source: https://github.com/AnEntrypoint/wireweave/blob/4508d66ff4cd3fde31959cc8b998810f367be321/src/relay-pool.js lines 5 to 10.

## Discord API and libraries

Discord Gateway intents are mandatory on API v8 and above. MESSAGE_CONTENT is privileged and required for content, embeds, attachments, components and polls. GUILD_PRESENCES and GUILD_MEMBERS are off by default and privileged. GUILDS covers channel create, update and delete plus threads and stage events. Source: https://docs.discord.com/developers/events/gateway

Discord voice uses a Gateway voice state update with guild_id and channel_id, then a separate voice WebSocket and UDP connection. Voice gateway version 8 is recommended. Opus audio uses two channels and a 48000 Hz sample rate. Voice gateway compatible encryption modes always include aead_xchacha20_poly1305_rtpsize and may include aead_aes256_gcm_rtpsize. A 32 byte secret_key arrives in Opcode 4 Session Description. Speaking uses Opcode 5 and a nonzero bitmask. Resume uses sequence numbers and Opcode 7. DAVE end-to-end encryption is supported by the current voice stack. Sources: https://docs.discord.com/developers/topics/voice-connections and https://daveprotocol.com

Discord voice state carries one guild_id, one channel_id and one user_id per voice session. A single bot user therefore occupies one voice channel per guild. Distinct simultaneous Discord voice identities in the same guild require distinct bot users and distinct bot tokens. The bridge declares DISCORD_VOICE_TOKEN_COUNT and DISCORD_VOICE_TOKEN_1 through DISCORD_VOICE_TOKEN_N in .env.example. Sources: https://docs.discord.com/developers/topics/voice-connections and https://docs.discord.com/developers/resources/voice

Package versions read from the npm registry on 2026-11-25: discord.js 14.28.1, @discordjs/voice 0.19.2, nostr-tools 2.26.1, werift 0.28.0, zod 4.6.7, typescript 5.9.3, tsx 4.23.15, opusscript 0.0.8.

@discordjs/voice 0.19.2 requires Node.js 22.12.0 or newer, supports send and receive audio, uses one encryption library only if Node lacks aes-256-gcm, ships a DAVE implementation, and prefers @discordjs/opus or opusscript for Opus. VoiceReceiver.subscribe returns a readable stream of Opus packets for a target user id. Sources: https://unpkg.com/@discordjs/voice@0.19.2/README.md and https://discord.js.org/docs/packages/voice/main/VoiceReceiver:Class

werift 0.28.0 provides a browser-compatible RTCPeerConnection model in Node.js with Opus codecs, tracks, transceivers, trickle ICE, DTLS-SRTP and ICE restart. Source: https://unpkg.com/werift@0.28.0/README.md

## Operational facts

The local .env is ignored, mode 600, and contains only a control token value in this checkout. The token value was never copied into a transcript, source file, log or report. The GitHub repository AnEntrypoint/zellous-discord is public and main is the working branch.