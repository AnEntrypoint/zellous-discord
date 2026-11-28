# RELEASE_NOTES.md

## 2026-11-25: Release candidate with voice acceptance held

Status: local main is complete through the operator runbook. Voice acceptance is held only for the owner-installed two-token DISCORD_VOICE_TOKENS pool. Portal intent approval, relay-set confirmation and owner key placement are not held; owner-signed publication and two-way text reflection are witnessed.

Included in the local tree:

- The complete standalone bridge source, protocol contract, durable ledger, room and message synchronization, per-user voice workers, secret scanner, CI, health checks, deployment profile, verification matrix and full witness suite.
- Deterministic startup reconciliation that publishes a signed kind 30078 room snapshot to the configured relays.
- A read-only live inventory witness that reported 21 Discord rooms and 21 zellous rooms with no missing rooms and no mismatches.
- Local unit tests 10/10, integration tests 6/6, secret scan clean, secret red check pass, build pass and restart recovery pass.

Operator contract:

- DISCORD_TOKEN is the control-plane token. DISCORD_VOICE_TOKENS is a comma-separated pool with the exact shape DISCORD_VOICE_TOKENS=bot-token-1,bot-token-2,bot-token-N. No spaces, quotes, trailing comma or numbered variables.
- At least two distinct voice bot tokens are required. One token authenticates one bot user; one standard guild voice state is singular for guild_id and user_id; N simultaneous Discord voice identities need N distinct bot users and credentials.
- Every voice bot in guild 367741339393327104 needs VIEW_CHANNEL, CONNECT, SPEAK and REQUEST_TO_SPEAK. The control bot additionally needs SEND_MESSAGES, MUTE_MEMBERS, DEAFEN_MEMBERS, MOVE_MEMBERS, USE_VAD, MANAGE_WEBHOOKS, MANAGE_CHANNELS and MANAGE_ROLES.
- Required intents include GUILDS 1<<0, GUILD_VOICE_STATES 1<<7, GUILD_MESSAGES 1<<9, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING, and privileged GUILD_MEMBERS 1<<1, GUILD_PRESENCES 1<<8, MESSAGE_CONTENT 1<<15.
- The historical development relay set was wss://relay.primal.net,wss://nos.lol,wss://offchain.pub,wss://nostr-pub.wellorder.net,wss://relay.snort.social,wss://relay.damus.io. Stage 5 replaced it with the live Pages default wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. ZELLOUS_RELAYS is the optional override; no owner relay-set confirmation remains.
- Token values stay in .env at mode 600. They are never copied into chat, the spec, a transcript, a log, a report, a commit, a fixture or test output. SecretString, the redacting logger and the secret scanner enforce this.

Voice acceptance hold:

The historical final gated window zellous-discord-final-3 ended ZDBRIDGE_DONE 1 because npm run live:voice failed with VOICE_POOL_INSUFFICIENT. That release hold is superseded. Dispatcher resumes only after the owner supplies the two-token DISCORD_VOICE_TOKENS pool and installs both bots. Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off.

## 2026-11-25: Stage 5 live Pages alignment

The bridge now imports the live GitHub Pages wireweave pin f944146955ca886370f3de464865f311998cb25b, uses the live four-relay default wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social, and supports optional ZELLOUS_RELAYS override. NOSTR_RELAYS remains a compatibility alias. The protocol contract records the five changed live-pin files and the added relay, streamId, src, muteMs, unmuteMs, fragment, clipSpliced, relayed and remoteKeys fields. The dispatcher chose the live values; no owner relay-set confirmation remains. The Social SDK provisional-account endpoint is unavailable, so DISCORD_VOICE_TOKENS remains required. Voice acceptance is held only for the owner-installed two-token voice pool. Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off.

## 2026-11-26: Stage 6 control-plane run with opt-in privileged intents

The control-plane bridge now connects with the existing .env token and guild 367741339393327104. DISCORD_PRIVILEGED_INTENTS defaults to false, so Gateway identify uses only GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING and GUILD_VOICE_STATES. Message content, presence and member-list enrichment are explicitly degraded while DISCORD_PRIVILEGED_INTENTS=false. Portal approval is not held for text reflection: Gateway IDs plus REST content fetch make Discord-origin text reflection work with privileged intents off.

Per-user voice reflection remains degraded because DISCORD_VOICE_TOKENS has no entries. /health reports status degraded, degradedFeatures, privilegedIntentsEnabled, gatewayIntents, voiceTokenCount and voiceReflectionComplete=false. No mixed-voice fallback is claimed. Live GitHub Pages remains the runtime source of truth with pin f944146955ca886370f3de464865f311998cb25b and the four-relay default.

Narrow witnesses cover config:check, live:inventory, serve plus /health, unit/typecheck, secret scan, intent:guard, intent:red-check and serve:check. No final gated window or push ran because the voice-token pool and done section are still outstanding.

## 2026-11-26: Live Pages pin drift and owner identity fix

The live GitHub Pages artifact moved from the spec-recorded pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d to 5d451241587181e471e263f44db993ba8e2d5764 on 2026-11-26. A cache-busting read on 2026-11-27 moved it to 8a4a5002d878e6f849068106a92339f0f6be02dc. Runtime follows the current live Pages pin and four-relay default. docs/LIVE_PIN_DIFF.md records the six-file protocol diff, including hub-liveness heartbeats, relays maps, hub claims, uplinkClass, SFU route state and unmuteMs clip splicing.

The Nostr adapter now imports the bridge-derived private key into wireweave auth, loads the derived server channel set and switches to that server before subscribing, which fixes the owner-only channel-create crash observed during the first live serve probe. Initial Discord Gateway channel events are suppressed until ClientReady; startup reconciliation remains the source for the initial room inventory.

## 2026-11-26: Read-only startup reconciliation guard

The first live serve probes exposed an idempotency defect: startup reconciliation saw two already-populated inventories with an empty local mapping ledger and applied creates to both sides, which created duplicate Discord channels and triggered wireweave rename conflicts. The engine now matches existing rooms by type, name, position, parent and topic before any create, and ZDBRIDGE_READ_ONLY=1 makes startup reconciliation map-only. All wireweave channel and chat operations in the Nostr adapter are awaited so their rejections are caught instead of becoming unhandled process crashes. serve:check uses read-only startup reconciliation.

The live guild currently has more Discord channels than the last published zellous channel snapshot because of that earlier startup write. No further destructive cleanup or channel deletion was performed; the duplicates and the exact 1:1 live inventory remain open until the owner or dispatcher authorizes cleanup or a new snapshot.

## 2026-11-26: Reversible new-snapshot reconciliation

The 174 extra Discord channels from the earlier live-serve probe are historical. The owner authorized cleaning up duplicate channels on both Discord and Zellous. Owner-authorized reversible duplicate cleanup preserves canonical channels, deletes only bridge-created duplicate channels, deduplicates relay snapshot entries, records exact before/after counts and IDs, writes cleanup-backup.json at mode 600 and supports cleanup-rollback. destructive cleanup is limited to bridge-created duplicates. The earlier relay-only reversible snapshot reconciliation still uses data/snapshot-backup.json, snapshot:rollback and npm run snapshot:red-check to prove read-only startup creates no Discord channel IDs.

docs/SPEC_ALIGNMENT.md maps the updated facts checked, architecture and done sections into the protocol contract. The current live Pages pin f944146955ca886370f3de464865f311998cb25b is the runtime source of truth; pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d, previous live pin 5d451241587181e471e263f44db993ba8e2d5764 and retired live pin 8a4a5002d878e6f849068106a92339f0f6be02dc are historical only.

## 2026-11-27: Live Pages pin drift

A cache-busting live Pages read on 2026-11-27 resolved wireweave pin 8a4a5002d878e6f849068106a92339f0f6be02dc with the same four-relay default. GitHub comparison from previous live pin 5d451241587181e471e263f44db993ba8e2d5764 to that pin changed exactly src/voice.js with late-joiner and same-pubkey rejoin fixes; the development-to-current comparison still changes exactly six src files. Voice acceptance remains held for a distinct installed identity.

## 2026-11-26: Stage 7 owner identity and Discover preparation

Identity plumbing now uses ownerHex(config) / bridgeSecretKey(config) with owner hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711 and server id 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711:discord-367741339393327104. BRIDGE_PRIVATE_KEY_HEX is an .env placeholder; tests use a throwaway key. discover:publish builds owner-signed kind 34550 metadata, kind 30078 Discover listing, kind 30078 roles and owner-author kind 30078 channel snapshot with increasing created_at, at least one text channel and one type:page rules channel. chat:post maps kind 42 root SHA-256(serverId + ":" + channelId). Startup reconciliation and event ingest are read-only by default; Zellous-to-Discord roomId mapping and the two room.upsert REST 400 paths are guarded.

Owner-signed publication uses the existing 64-hex private key in .env. Rotation of the chat-exposed key remains an open note. Discover browser evidence is part of the final witness window.

Open note: the owner nsec appeared in chat before this run, so key rotation remains an open operational risk. The existing 64-hex private key in .env was used for owner-signed publication and was never echoed. Rotation can be done later by replacing BRIDGE_PRIVATE_KEY_HEX and republishing the owner bundle.
## 2026-11-26: Owner-authorized reversible duplicate cleanup

The owner authorized cleaning up duplicate channels on both Discord and Zellous. npm run cleanup preserves canonical channels, deletes only bridge-created duplicates, deduplicates relay snapshot entries, writes cleanup-backup.json at mode 600 and reports exact before/after counts and IDs. npm run cleanup:rollback and npm run cleanup:red-check provide the rollback path and the no-canonical-deletion/no-new-duplicate red check. destructive cleanup is limited to bridge-created duplicates. The earlier relay-only snapshot reconciliation remains available.

Cleanup result: before=502 after=21 canonical=21 deleted=481 missingCanonical=0 remainingDuplicates=0 afterDuplicateKeys=0. Canonical IDs: 1004383070704631888,1010485058483798096,1046993089752993792,1070605940530880562,1073954484759306311,1073958855979057162,1079107293813145661,1177205540984725524,1212806456668061707,1283057471031738379,1385912163423490228,1428093284433137666,1428093566105686127,1497680326343000235,1554075312499859496,1554075452757385216,805320534370943016,843838504822767647,843928612276273162,863839538966298654,911992819252625440. Deleted duplicate IDs run from 1575438397944635422 through 1575448748891574362; the exact list is in data/cleanup-backup.json and the command output. Before relay snapshot event 355f818142604c34e40a1ec953f8e0cd57ad494f11e195cc5a7cca714147a621 was replaced by 33cd548f3a3aa7ce05591dd16e2f036036bc8901a4ea7acfd32d6dc38557fd75 with deletion request fd69100feba6bf9cb4e5944d9488b3326658408e6c300769bacca08c842b2120. Browser evidence proved the Discord Bridge Discover card, join, 22 channels including Rules, and the kind 42 chat message bridge chat witness 1795705113 in the live DOM; screenshot at /config/workspace/tmp/zellous-discord/discover.png.

## 2026-11-27: Stage 2 text and Stage 3 credential-ready voice reflection

The live text path now maps discord.js Gateway messages into canonical REST-shaped records, uses stable snowflake versions, subscribes to wireweave per-message events, resolves canonical channels through MappingStore and suppresses bridge echoes with native IDs in data/bridge-echoes.json. Read-only room guards remain active. A reversible live two-way marker witness and red check prove Discord-origin kind 42 root correctness and Zellous-origin Discord channel delivery without duplicates or channel-count changes. VoiceReflection is wired into BridgeService with credential-ready per-user Discord Opus, worker/router and Werift paths; health and witnesses remain parameterized so zero tokens stay honestly degraded and voiceReflectionComplete requires at least two identities plus real frames in both directions. Stage 1 is held only for the owner-installed two-token voice pool. Portal intent approval is not held: text reflection works with privileged intents off by Discord Gateway IDs plus REST content fetch and stable native-id deduplication. Voice is not DONE.

## 2026-11-27: One-token voice readiness

One distinct DISCORD_VOICE_TOKENS entry is now reported honestly as voiceTokenCount=1, voicePoolState=insufficient and voiceReadinessReason=VOICE_POOL_INSUFFICIENT. voiceReflectionComplete stays false, DISCORD_PRIVILEGED_INTENTS stays false after the control-plane gateway rejected privileged intents, and health still lists per-user-voice-reflection as degraded. A second distinct installed bot token remains held; voice is not DONE.

## 2026-11-27: Final voice proof path

The live service now accepts a persisted per-user voice proof through /voice-proof. The gated voice proof uses two distinct installed bot identities, encodes real Opus frames, routes Discord-origin frames into the per-worker/Werift path, sends Zellous-origin frames into Discord voice, and rejects mixed audio, missing directions or incomplete health. data/voice-proof.json is mode 600 and health turns ok only after both directions are proven.

## 2026-11-28: live-client inference reflection and pin drift

A live Pages read resolved wireweave pin f944146955ca886370f3de464865f311998cb25b. GitHub comparison from 8a4a5002d878e6f849068106a92339f0f6be02dc to f944146955ca886370f3de464865f311998cb25b changes only src/unread.js, so room hashes, kind 42 e roots, Nostr kinds, tags and relay defaults are unchanged; runtime, lockfile, config and live-alignment witness follow the new pin and the older pins are historical. Live Zellous UI kind 42 events carry only an e root, so the bridge no longer suppresses them for a missing synthetic attribution tag: resolveZellousMessage resolves the author from the event pubkey when no attribution tag exists, keeps duplicated or conflicting attribution tags fail-closed, and keeps unknown roots fail-closed. ui:marker types unique markers into the live Zellous inference and warez-and-wonders inputs through playwriter and verifies each reaches only its matching Discord channel; the earlier publishChatEvent-only witness was removed. Voice acceptance remains held for a distinct installed identity.
