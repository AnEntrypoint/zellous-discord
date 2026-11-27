# SPEC_ALIGNMENT.md

This document maps the changed facts checked, architecture and done sections of /config/workspace/hyperagent/specs/discord-bridge.md into the repository contract on 2026-11-26.

Current live GitHub Pages wireweave pin: 8a4a5002d878e6f849068106a92339f0f6be02dc.
Earlier live pin: 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d; it is historical only.
Previous live pin: 5d451241587181e471e263f44db993ba8e2d5764; it is historical only.
Development pin: 4508d66ff4cd3fde31959cc8b998810f367be321.
The six-file protocol drift is reconciled in docs/LIVE_PIN_DIFF.md: src/hub-liveness.js, src/modules/voice-thread.js, src/vad/clip-filter.js, src/vad/detector.js, src/voice-thread-audio.js and src/voice.js.

The live four-relay default is wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. ZELLOUS_RELAYS is the optional override; NOSTR_RELAYS is a compatibility alias.

The earlier live-serve probe left 174 extra Discord channels in guild 367741339393327104; that fact is historical. The owner authorized cleaning up duplicate channels on both Discord and Zellous. Owner-authorized reversible duplicate cleanup deletes only bridge-created duplicate channels, preserves canonical channels, reports exact before/after counts and IDs, and records pre-cleanup state in cleanup-backup.json. cleanup-rollback republishes the previous relay snapshot and recreates the deleted channels with new Discord IDs. destructive cleanup is limited to bridge-created duplicates. The earlier relay-only reversible new-snapshot reconciliation publishes a signed kind 30078 channel snapshot, records the previous relay event and content in data/snapshot-backup.json, and supports snapshot rollback with a newer replaceable event carrying the previous content. No Discord channel is created or deleted by that reconciliation.

The control-plane bridge runs with the existing .env token, DISCORD_PRIVILEGED_INTENTS=false by default, non-privileged Gateway intents, explicit degraded features in /health, real serve-health witnesses and PID cleanup. Startup reconciliation is read-only by default via LIVE_INVENTORY_MODE=read-only and ZDBRIDGE_READ_ONLY=1.

Publication is gated by final witness window zellous-discord-live-1, one push, git ls-remote origin main agreement and DONE. The voice-token pool remains explicitly degraded as VOICE_POOL_ABSENT.

destructive cleanup is owner-authorized only for bridge-created duplicate channels and is reversible through cleanup-backup.json and cleanup-rollback; the relay-only snapshot reconciliation remains non-destructive.

## Stage 7 live Discover alignment

The immediate live acceptance criterion is that guild 367741339393327104 appears as a card in live Zellous Discover and is interactable with the existing Discord token. The owner identity is npub1nz90wez9p4cj3csw35csqnhmw9lazz4l6709wgjyvkrrmq2xsugsx4cz42, decoded to hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711. With ZELLOUS_SERVER_ID=auto the required server id is 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711:discord-367741339393327104.

BRIDGE_PRIVATE_KEY_HEX is a placeholder in .env.example. The owner must place the matching 64-hex private key directly into the ignored .env; the bridge reads it at runtime and never echoes it. Tests use a generated throwaway key with ZELLOUS_SERVER_OWNER_HEX overridden to that throwaway pubkey. No chat-exposed nsec is copied into source, docs, logs or reports.

Owner bundle events are zellous-discover: kind 34550 server metadata with d=discord-367741339393327104, name and color; kind 30078 Discover listing with d=zellous-discover:<serverId>, t=zellous-discover, status=listed, by=ownerHex, name, description, HTTPS icon, category, language, tags and guidelines=true; kind 30078 roles with d=zellous-roles:<serverId> and at least one appointed admin; and owner-author kind 30078 channel snapshot with d=zellous-channels:<serverId>, at least one text channel and one type:page rules channel. Event timestamps increase.

Kind 42 chat uses e root SHA-256(serverId + ":" + channelId). Zellous-to-Discord messages strip the room- prefix from roomId before REST calls; Discord-to-Zellous messages use chat.sendTo with the owner server id and channel id. Startup reconciliation and the event-ingest path remain read-only by default so no Discord channel writes occur when the expected snapshot exists.

Only the owner-installed two-token DISCORD_VOICE_TOKENS pool remains held. Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off. Owner-signed events use BRIDGE_PRIVATE_KEY_HEX from the ignored .env and have been published.
## Owner-authorized reversible duplicate cleanup alignment

The changed facts checked, architecture, Stage 7, who-owns-what and done sections authorize cleanup of duplicate channels on both Discord and Zellous. Owner-authorized reversible duplicate cleanup preserves canonical channels, deletes only bridge-created duplicates, reports exact before/after counts and IDs, records cleanup-backup.json and supports cleanup-rollback. destructive cleanup is limited to those duplicates. The final witness window zellous-discord-live-1 includes cleanup:red-check and its self-test.

Open note: chat-exposed owner key rotation risk remains; the existing key is used without echoing it.

owner-authorized reversible duplicate cleanup uses cleanup-backup.json, cleanup-rollback and cleanup:red-check; destructive cleanup is limited to bridge-created duplicates.

Only the owner-installed two-token DISCORD_VOICE_TOKENS pool remains held. Portal intent approval and relay-set confirmation are not held. Text reflection works with privileged intents off through Gateway IDs plus REST content fetch; the live four-relay default needs no owner confirmation.

One distinct DISCORD_VOICE_TOKENS entry is an insufficient one-identity voice pool. Health and witnesses report voiceTokenCount=1, voicePoolState=insufficient and voiceReadinessReason=VOICE_POOL_INSUFFICIENT, never VOICE_POOL_ABSENT. voiceReflectionComplete stays false and privilegedIntentsEnabled stays false. Only a second distinct installed bot token remains held.

The active acceptance claim is stopped. The distinct installed voice identity is held; voice:proof is not part of the green window until two distinct installed identities exist.

## Stage 5 per-channel routing alignment

Zellous-origin chat resolves its Discord target from the kind 42 e root, not from wireweave's active UI channel. channel:marker derives inference and warez-and-wonders from live Discord REST, proves each canonical root equals SHA-256(serverId:room-channelId), posts one unique marker per channel, and fails on a wrong-channel marker, a duplicated marker, an active-UI channel fallback or an unknown root that posts. channel-root:red-check verifies both roots against the live ledger. The active acceptance claim remains stopped and the distinct installed voice identity is held.
