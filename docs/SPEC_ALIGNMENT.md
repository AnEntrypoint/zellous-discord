# SPEC_ALIGNMENT.md

This document maps the changed facts checked, architecture and done sections of /config/workspace/hyperagent/specs/discord-bridge.md into the repository contract on 2026-11-26.

Current live GitHub Pages wireweave pin: 5d451241587181e471e263f44db993ba8e2d5764.
Earlier live pin: 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d; it is historical only.
Development pin: 4508d66ff4cd3fde31959cc8b998810f367be321.
The six-file protocol drift is reconciled in docs/LIVE_PIN_DIFF.md: src/hub-liveness.js, src/modules/voice-thread.js, src/vad/clip-filter.js, src/vad/detector.js, src/voice-thread-audio.js and src/voice.js.

The live four-relay default is wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. ZELLOUS_RELAYS is the optional override; NOSTR_RELAYS is a compatibility alias.

The earlier live-serve probe left 174 extra Discord channels in guild 367741339393327104. Those channels stay intact. Deleting or rewriting them is destructive outward cleanup and is not performed. The chosen reversible new-snapshot reconciliation publishes a signed kind 30078 channel snapshot containing all current Discord channels, records the previous relay event and content in data/snapshot-backup.json, and supports snapshot rollback with a newer replaceable event carrying the previous content. No Discord channel is created or deleted by this reconciliation.

The control-plane bridge runs with the existing .env token, DISCORD_PRIVILEGED_INTENTS=false by default, non-privileged Gateway intents, explicit degraded features in /health, real serve-health witnesses and PID cleanup. Startup reconciliation is read-only by default via LIVE_INVENTORY_MODE=read-only and ZDBRIDGE_READ_ONLY=1.

Publication remains held because the voice-token pool, privileged-intent approval, final gated window label zellous-discord-final-4 on tree cf8ff4a, one push, git ls-remote origin main agreement and DONE remain outstanding.

No destructive cleanup is performed on Discord channels by the reversible new-snapshot reconciliation.

## Stage 7 live Discover alignment

The immediate live acceptance criterion is that guild 367741339393327104 appears as a card in live Zellous Discover and is interactable with the existing Discord token. The owner identity is npub1nz90wez9p4cj3csw35csqnhmw9lazz4l6709wgjyvkrrmq2xsugsx4cz42, decoded to hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711. With ZELLOUS_SERVER_ID=auto the required server id is 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711:discord-367741339393327104.

BRIDGE_PRIVATE_KEY_HEX is a placeholder in .env.example. The owner must place the matching 64-hex private key directly into the ignored .env; the bridge reads it at runtime and never echoes it. Tests use a generated throwaway key with ZELLOUS_SERVER_OWNER_HEX overridden to that throwaway pubkey. No chat-exposed nsec is copied into source, docs, logs or reports.

Owner bundle events are zellous-discover: kind 34550 server metadata with d=discord-367741339393327104, name and color; kind 30078 Discover listing with d=zellous-discover:<serverId>, t=zellous-discover, status=listed, by=ownerHex, name, description, HTTPS icon, category, language, tags and guidelines=true; kind 30078 roles with d=zellous-roles:<serverId> and at least one appointed admin; and owner-author kind 30078 channel snapshot with d=zellous-channels:<serverId>, at least one text channel and one type:page rules channel. Event timestamps increase.

Kind 42 chat uses e root SHA-256(serverId + ":" + channelId). Zellous-to-Discord messages strip the room- prefix from roomId before REST calls; Discord-to-Zellous messages use chat.sendTo with the owner server id and channel id. Startup reconciliation and the event-ingest path remain read-only by default so no Discord channel writes occur when the expected snapshot exists.

Publication remains held until the owner places BRIDGE_PRIVATE_KEY_HEX in .env, because owner-signed events cannot be published with a wrong-pubkey listing.