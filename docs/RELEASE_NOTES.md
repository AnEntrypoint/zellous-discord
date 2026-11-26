# RELEASE_NOTES.md

## 2026-11-25: Release candidate held for owner voice credentials

Status: local main is complete through the operator runbook. Publication is held because the live voice smoke requires owner supplied credentials that are still pending.

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

Publication hold:

The final gated window zellous-discord-final-3 ended ZDBRIDGE_DONE 1 because npm run live:voice failed with VOICE_POOL_INSUFFICIENT. There was no push and no DONE report. The dispatcher should resume after the owner supplies the pool, installs the bots and enables the privileged intents, then rerun the final window and push origin main once. No relay-set confirmation remains.

## 2026-11-25: Stage 5 live Pages alignment

The bridge now imports the live GitHub Pages wireweave pin 5d451241587181e471e263f44db993ba8e2d5764, uses the live four-relay default wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social, and supports optional ZELLOUS_RELAYS override. NOSTR_RELAYS remains a compatibility alias. The protocol contract records the five changed live-pin files and the added relay, streamId, src, muteMs, unmuteMs, fragment, clipSpliced, relayed and remoteKeys fields. The dispatcher chose the live values; no owner relay-set confirmation remains. The Social SDK provisional-account endpoint is unavailable, so DISCORD_VOICE_TOKENS remains required. Publication is still held only for owner voice tokens; no final window rerun or push occurred in Stage 5.

## 2026-11-26: Stage 6 control-plane run with opt-in privileged intents

The control-plane bridge now connects with the existing .env token and guild 367741339393327104. DISCORD_PRIVILEGED_INTENTS defaults to false, so Gateway identify uses only GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING and GUILD_VOICE_STATES. Message content, presence and member-list enrichment are explicitly degraded until the owner enables those privileged intents and opts in.

Per-user voice reflection remains degraded because DISCORD_VOICE_TOKENS has no entries. /health reports status degraded, degradedFeatures, privilegedIntentsEnabled, gatewayIntents, voiceTokenCount and voiceReflectionComplete=false. No mixed-voice fallback is claimed. Live GitHub Pages remains the runtime source of truth with pin 5d451241587181e471e263f44db993ba8e2d5764 and the four-relay default.

Narrow witnesses cover config:check, live:inventory, serve plus /health, unit/typecheck, secret scan, intent:guard, intent:red-check and serve:check. No final gated window or push ran because the voice-token pool and done section are still outstanding.

## 2026-11-26: Live Pages pin drift and owner identity fix

The live GitHub Pages artifact moved from the spec-recorded pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d to 5d451241587181e471e263f44db993ba8e2d5764. Runtime now follows the current live Pages pin and four-relay default. docs/LIVE_PIN_DIFF.md records the six-file protocol diff, including hub-liveness heartbeats, relays maps, hub claims, uplinkClass, SFU route state and unmuteMs clip splicing.

The Nostr adapter now imports the bridge-derived private key into wireweave auth, loads the derived server channel set and switches to that server before subscribing, which fixes the owner-only channel-create crash observed during the first live serve probe. Initial Discord Gateway channel events are suppressed until ClientReady; startup reconciliation remains the source for the initial room inventory.

## 2026-11-26: Read-only startup reconciliation guard

The first live serve probes exposed an idempotency defect: startup reconciliation saw two already-populated inventories with an empty local mapping ledger and applied creates to both sides, which created duplicate Discord channels and triggered wireweave rename conflicts. The engine now matches existing rooms by type, name, position, parent and topic before any create, and ZDBRIDGE_READ_ONLY=1 makes startup reconciliation map-only. All wireweave channel and chat operations in the Nostr adapter are awaited so their rejections are caught instead of becoming unhandled process crashes. serve:check uses read-only startup reconciliation.

The live guild currently has more Discord channels than the last published zellous channel snapshot because of that earlier startup write. No further destructive cleanup or channel deletion was performed; the duplicates and the exact 1:1 live inventory remain open until the owner or dispatcher authorizes cleanup or a new snapshot.

## 2026-11-26: Reversible new-snapshot reconciliation

The 174 extra Discord channels from the earlier live-serve probe are kept intact. Snapshot reconciliation is now relay-only, reversible and non-destructive: npm run snapshot:reconcile publishes all current Discord channels as a signed kind 30078 snapshot, records the previous snapshot in data/snapshot-backup.json, and reports exact discordCount, zellousCount, duplicateNames, eventId, previousEventId and rollbackPath. npm run snapshot:rollback republishes the previous content as a newer replaceable event. npm run snapshot:red-check starts the service read-only after the expected snapshot exists and proves no Discord channel IDs are created.

docs/SPEC_ALIGNMENT.md maps the updated facts checked, architecture and done sections into the protocol contract. The current live Pages pin 5d451241587181e471e263f44db993ba8e2d5764 is the runtime source of truth; pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d is historical.

## 2026-11-26: Stage 7 owner identity and Discover preparation

Identity plumbing now uses ownerHex(config) / bridgeSecretKey(config) with owner hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711 and server id 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711:discord-367741339393327104. BRIDGE_PRIVATE_KEY_HEX is an .env placeholder; tests use a throwaway key. discover:publish builds owner-signed kind 34550 metadata, kind 30078 Discover listing, kind 30078 roles and owner-author kind 30078 channel snapshot with increasing created_at, at least one text channel and one type:page rules channel. chat:post maps kind 42 root SHA-256(serverId + ":" + channelId). Startup reconciliation and event ingest are read-only by default; Zellous-to-Discord roomId mapping and the two room.upsert REST 400 paths are guarded.

Live owner-signed publication and Discover browser evidence remain held until the owner places BRIDGE_PRIVATE_KEY_HEX in .env and decides whether to rotate the chat-exposed nsec.

Open note: the owner nsec appeared in chat before this run, so key rotation remains an open operational risk. The existing 64-hex private key in .env was used for owner-signed publication and was never echoed. Rotation can be done later by replacing BRIDGE_PRIVATE_KEY_HEX and republishing the owner bundle.