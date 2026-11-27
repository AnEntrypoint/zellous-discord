# AGENTS.md

Work only in this standalone bridge repository. The zellous app and wireweave are read-only references.

The Discord token and every voice-pool token are secrets. Never place their values in source, docs, fixtures, logs, reports or command output. Use SecretString and the redacting logger.

DISCORD_VOICE_TOKENS is a comma-separated pool. Each token belongs to a distinct Discord bot user invited to guild 367741339393327104 with View Channel, Connect, Speak and Request to Speak. A single bot user has one guild voice state, so N simultaneous Discord voice identities need N pool entries.

The control-plane bridge connects today with non-privileged intents GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING and GUILD_VOICE_STATES. DISCORD_PRIVILEGED_INTENTS is false by default; set it to true only after MESSAGE_CONTENT, GUILD_PRESENCES and GUILD_MEMBERS are enabled in the Developer Portal. With the switch off, message content, presence and member-list enrichment are explicitly degraded and /health reports them.

The zellous side imports the live GitHub Pages wireweave pin 5d451241587181e471e263f44db993ba8e2d5764 with injected nostrTools, xstate, storage, ws and a Node WebRTC polyfill. It uses the live four-relay default with optional ZELLOUS_RELAYS override. Development pin 4508d66ff4cd3fde31959cc8b998810f367be321 is development context reconciled in docs/LIVE_PIN_DIFF.md. Room hashes, Nostr kinds, tags, voice room IDs and relay defaults are recorded in docs/PROTOCOL.md and docs/RESEARCH.md.

Code has no comments. Put operating facts here and design rationale in docs.

npm install emits gitignore-fallback and skipped-integrity warnings for the pinned wireweave git dependency. These are packaging notices, not a bridge failure. npm ci --ignore-scripts avoids the esbuild postinstall notice. The discord.js transitive @sapphire/shapeshift deprecation notice is also external and not a bridge failure.

Local commits are made as lanmower with no trailers. Phase A records every change in docs/PENDING_VALIDATION.md. Phase B runs one final witness window and pushes only if every listed check passes.

The spec recorded live pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d, but a fresh live Pages read on 2026-11-26 resolved to 5d451241587181e471e263f44db993ba8e2d5764. Runtime follows the current live Pages artifact; docs/LIVE_PIN_DIFF.md records the drift and the done-section publication hold.

Startup reconciliation is read-only by default via LIVE_INVENTORY_MODE=read-only and ZDBRIDGE_READ_ONLY=1. Set LIVE_INVENTORY_MODE=reconcile only when external channel writes are intended; the first live serve probe showed that an empty mapping ledger plus two populated inventories can otherwise create duplicate Discord channels.

The 174 extra Discord channels from the earlier live-serve probe are historical. The owner authorized cleaning up duplicate channels on both Discord and Zellous. Owner-authorized reversible duplicate cleanup preserves canonical channels, deletes only bridge-created duplicate channels, deduplicates the relay channel snapshot, records exact before/after counts and IDs, and backs up pre-cleanup state in data/cleanup-backup.json at mode 600. npm run cleanup:rollback restores the previous snapshot and recreates duplicate channels with new Discord IDs. npm run cleanup:red-check proves no canonical channel is deleted and no new duplicate appears after read-only startup. The earlier relay-only reversible new-snapshot reconciliation still uses data/snapshot-backup.json and snapshot:rollback. destructive cleanup is limited to bridge-created duplicates.

Stage 7 owner identity is npub1nz90wez9p4cj3csw35csqnhmw9lazz4l6709wgjyvkrrmq2xsugsx4cz42 / hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711. BRIDGE_PRIVATE_KEY_HEX is a placeholder in .env.example; the owner places the matching 64-hex private key directly into the ignored .env. Tests use a generated throwaway key. Owner-signed Discover metadata, listing, roles, channel snapshot and kind 42 chat require that key. Never copy an nsec or private key into source, docs, logs or reports.
Open note: the owner nsec appeared in chat before this run, so key rotation remains an open operational risk. The existing 64-hex private key in .env was used for owner-signed publication and was never echoed. Rotation can be done later by replacing BRIDGE_PRIVATE_KEY_HEX and republishing the owner bundle.

Stage 2 live text reflection uses Gateway camelCase timestamps, stable Discord snowflake versions, wireweave per-message "message" events, canonical channel mapping through MappingStore, native-id echo suppression in data/bridge-echoes.json, and read-only room guards. Stage 3 wires VoiceReflection into BridgeService with credential-ready per-user Discord Opus and Werift paths; zero tokens remain honestly degraded and voiceReflectionComplete requires at least two identities and real frames in both directions. Stage 1 remains held only for owner-installed DISCORD_VOICE_TOKENS. Portal intent approval and relay-set confirmation are not held because text reflection uses Gateway IDs plus REST content fetch with privileged intents off and the live four-relay default is the runtime source of truth. Do not request token values and do not claim voice DONE.

Portal intent approval and relay-set confirmation are not held. Text reflection works with privileged intents off through Gateway IDs plus REST content fetch; the live four-relay default needs no owner confirmation. Only the two-token DISCORD_VOICE_TOKENS pool remains held.

One distinct DISCORD_VOICE_TOKENS entry is an insufficient one-identity voice pool. Health and witnesses report voiceTokenCount=1, voicePoolState=insufficient and voiceReadinessReason=VOICE_POOL_INSUFFICIENT, never VOICE_POOL_ABSENT. voiceReflectionComplete stays false and DISCORD_PRIVILEGED_INTENTS stays false because the control-plane gateway rejects privileged intents. Only a second distinct installed bot token remains held; voice is not DONE.
