# SPEC_ALIGNMENT.md

This document maps the changed facts checked, architecture and done sections of /config/workspace/hyperagent/specs/discord-bridge.md into the repository contract on 2026-11-26.

Current live GitHub Pages wireweave pin: 4b73168fbfbb2f13f11e56e368244166955f6af2.
Earlier live pin: 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d; it is historical only.
Previous live pin: 5d451241587181e471e263f44db993ba8e2d5764; it is historical only.
Prior live pin: a370a9b15d9c3fa916e7312df6682d0a27cc2293; it is historical only.
Retired live pin: 8a4a5002d878e6f849068106a92339f0f6be02dc; it is historical only.
Development pin: 4508d66ff4cd3fde31959cc8b998810f367be321.
The seven-file protocol drift is reconciled in docs/LIVE_PIN_DIFF.md: src/hub-liveness.js, src/modules/voice-thread.js, src/unread.js, src/vad/clip-filter.js, src/vad/detector.js, src/voice-thread-audio.js and src/voice.js.

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

The installed voice pool needs no further credential: one bot identity reflects a mix. Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off. Owner-signed events use BRIDGE_PRIVATE_KEY_HEX from the ignored .env and have been published.
## Owner-authorized reversible duplicate cleanup alignment

The changed facts checked, architecture, Stage 7, who-owns-what and done sections authorize cleanup of duplicate channels on both Discord and Zellous. Owner-authorized reversible duplicate cleanup preserves canonical channels, deletes only bridge-created duplicates, reports exact before/after counts and IDs, records cleanup-backup.json and supports cleanup-rollback. destructive cleanup is limited to those duplicates. The final witness window zellous-discord-live-1 includes cleanup:red-check and its self-test.

Open note: chat-exposed owner key rotation risk remains; the existing key is used without echoing it.

owner-authorized reversible duplicate cleanup uses cleanup-backup.json, cleanup-rollback and cleanup:red-check; destructive cleanup is limited to bridge-created duplicates.

The installed voice pool needs no further credential: one bot identity reflects a mix. Portal intent approval and relay-set confirmation are not held. Text reflection works with privileged intents off through Gateway IDs plus REST content fetch; the live four-relay default needs no owner confirmation.

A DISCORD_VOICE_TOKENS pool of one or more entries reports voicePoolState=ready; zero entries report VOICE_POOL_ABSENT. Until real frames flow both ways the reason is VOICE_FRAMES_UNPROVEN, voiceReflectionComplete stays false and privilegedIntentsEnabled stays false. A human joining a Discord voice channel brings one pool bot into that channel and later humans share it.

The active acceptance claim is stopped. The voice proof is held until real frames flow in both directions; voice:proof is not part of the green window.

## Stage 5 per-channel routing alignment

Zellous-origin chat resolves its Discord target from the kind 42 e root, not from wireweave's active UI channel. channel:marker derives inference and warez-and-wonders from live Discord REST, proves each canonical root equals SHA-256(serverId:room-channelId), posts one unique marker per channel, and fails on a wrong-channel marker, a duplicated marker, an active-UI channel fallback or an unknown root that posts. channel-root:red-check verifies both roots against the live ledger. The active acceptance claim remains stopped and the distinct installed voice identity is held.

## Stage 6 live server identity alignment

Discord REST guild name 247420 is the source of truth for kind 34550 metadata, the owner-signed kind 30078 Discover listing, the cached zn_servers name and the playwriter browser DOM. source:truth drives the static Pages client through playwriter, refreshes cached zn_servers with the Discord guild icon URL, prints equality across those five name surfaces and five icon surfaces, and proves the Zellous voice-channel heading and every Discord voice channel visible in the browser DOM. The Node wireweave storage reloads current persisted values and preserves the Discord guild icon when wireweave rewrites zn_servers, so a long-running service cannot erase the carried-over logo. source:red-check fails on a stale name, static or missing guild logo, hidden voice bridge, cached-only evidence, wrong owner signature, missing browser channel or a secret value. presence:red-check reads the current live service log and fails on the nullable oldPresence error, degraded presence or a gateway error. The row 26 gate label is already corrected. The active acceptance claim remains stopped and the distinct installed voice identity is held.

## Live Zellous UI reflection alignment

I reported, verbatim, that Zellous inference messages did not reach Discord inference. A unique marker typed in the live Zellous inference UI must reach only Discord inference (1073958855979057162), and a second marker typed in warez-and-wonders must reach only its matching Discord channel. ui:marker drives the static Pages client through playwriter, reads the active channel and message input for each send, matches the browser event ID and pubkey to the kind 42 relay event, verifies the canonical e root and visible attribution on the Discord message, and fails on an active-UI channel fallback, a wrong-channel marker, a duplicate or echo, a synthetic publishChatEvent-only witness, a cached-only server-name claim, missing live UI type or Enter or screenshot steps, an unknown-root post, a stale dist, a changed channel count, more than one live service or a secret value. resolveZellousMessage derives the author from the live client pubkey when no attribution tag exists and keeps unknown roots fail-closed. The current live Pages wireweave pin is f944146955ca886370f3de464865f311998cb25b; the 8a4a5002d878e6f849068106a92339f0f6be02dc drift changes only src/unread.js and no protocol file. The active acceptance claim remains stopped and the distinct installed voice identity is held.

## Relay copies, client logo rendering and the voice bridge on both sides

The live Zellous client keeps whichever kind 34550 copy arrives last and compares no created_at, so one relay holding the old Discord Bridge event can win. source:truth queries every relay separately and fails on a stale name or logo. Window A has no relay write; window B is read-only; relay:heal makes one bounded republish of the kind 34550 event to relays that serve a stale copy, only 30 minutes after the last publish and never twice on one tree, and records its time and result in data/relay-heal.json. The live client server rail renders the first letter and the iconColor only, so the Discord guild logo is carried on the kind 34550 icon tag, the Discover listing icon and the cached server icon, and the rail rendering is reported honestly as clientLimits in data/source-truth.json instead of being claimed. The voice bridge is visible on the Zellous side as the three Discord voice channels under the VOICE CHANNELS heading, and on the Discord side as a pool bot in the channel a human joined: health reports voiceSessions and voice:bridge compares each bot with the Discord voice state. The active acceptance claim is stopped.

## Voice join reflection in both directions

A Discord human joining voice starts a pool bot in that channel and the Zellous voice bridge participant in the matching room; a Zellous human heartbeat in a mapped voice room starts a pool bot in the matching Discord channel. voice:bridge compares health voiceSessions and zellousVoiceBridge with the Discord voice state and fails when a join on either side leaves the other side unstarted. Pool tokens are probed at startup and invalid or duplicate bot identities are skipped, so one working token is enough. Media is not reflected yet: voiceReflectionComplete stays false and the active acceptance claim is stopped.
