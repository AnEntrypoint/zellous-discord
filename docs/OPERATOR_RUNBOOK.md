# OPERATOR_RUNBOOK.md

This runbook is for the operator who supplies the remaining credentials and for the dispatcher that resumes the final window. It contains no secret values.

## 1. Exact voice-token pool shape

DISCORD_TOKEN is the single control-plane bot token. DISCORD_VOICE_TOKENS is a separate comma-separated pool of voice bot tokens. The exact shape is:

DISCORD_VOICE_TOKENS=bot-token-1,bot-token-2,bot-token-N

Use no spaces, no quotes, no trailing comma and no numbered DISCORD_VOICE_TOKEN_1 variables. Each entry must be one token for one distinct Discord application and bot user. At least two entries are required for the live voice smoke because the witness proves two distinct simultaneous Discord voice identities. N entries provide N simultaneous identities. The service binds one Discord voice connection per token and queues excess speakers when the pool is exhausted.

One bot token authenticates one bot user. A standard guild voice state is singular for guild_id and user_id. Gateway Opcode 4 has no user_id, so a second join in the same guild moves the same user and invalidates the previous voice session. Therefore N distinct simultaneous Discord voice participants require N distinct Discord user IDs and credentials. Mixed audio is never a substitute for per-user voice reflection.

## 2. Per-bot permissions

Install every voice bot in guild 367741339393327104 with VIEW_CHANNEL, CONNECT, SPEAK and REQUEST_TO_SPEAK. REQUEST_TO_SPEAK is required for stage voice channels. Grant the control bot VIEW_CHANNEL, SEND_MESSAGES, CONNECT, SPEAK, REQUEST_TO_SPEAK, MUTE_MEMBERS, DEAFEN_MEMBERS, MOVE_MEMBERS, USE_VAD, MANAGE_WEBHOOKS, MANAGE_CHANNELS and MANAGE_ROLES.

## 3. Gateway intents

The default Gateway identify payload uses GUILDS 1<<0, GUILD_VOICE_STATES 1<<7, GUILD_MESSAGES 1<<9, GUILD_MESSAGE_REACTIONS and GUILD_MESSAGE_TYPING. Set DISCORD_PRIVILEGED_INTENTS=true only after enabling GUILD_MEMBERS 1<<1, GUILD_PRESENCES 1<<8 and MESSAGE_CONTENT 1<<15 in the Developer Portal.

The privileged intents are GUILD_MEMBERS, GUILD_PRESENCES and MESSAGE_CONTENT. They stay opt-in because requesting them without Developer Portal approval closes the Gateway with Used disallowed intents. Portal approval is not held for the current text path: Discord-origin text reflection works with privileged intents off by using Gateway message IDs plus REST content fetch. With the switch off, /health reports message-content, presence and member-list enrichment as degraded.

## 4. Relay-set choice

The dispatcher chose the live GitHub Pages default relay set as the source of truth: wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. NOSTR_RELAYS carries this default. ZELLOUS_RELAYS is an optional comma-separated wss override. No owner relay-set confirmation remains.

The startup reconciliation publishes a signed kind 30078 channel snapshot to the chosen set; live inventory reads it back. A relay set that rejects the snapshot or returns a stale inventory stops the final window.

## 5. Token redaction rules

The owner edits /config/workspace/zellous-discord/.env directly and keeps it at mode 600. Do not paste token values into chat, the spec, a transcript, a log, a report, a commit, a fixture or test output. The dispatcher should relay only that the credentials were supplied, not the values.

.env is ignored and excluded from every commit. Secret values are wrapped in SecretString, redacted by the structured logger, scanned in the worktree and git history by scripts/secret-scan.mjs, and omitted from .env.example. The scanner self-test injects a token-like temporary fixture and must fail that scan. A real token-like string appearing in a committed file is a publication-stopping defect.

## 6. Why voice acceptance is held

The final gated witness window zellous-discord-final-3 ended with ZDBRIDGE_DONE 1. Local witnesses passed, historical live reconciliation was accepted by four of six development relays, and live inventory reported discordCount 21, zellousCount 21, no missing rooms and no mismatches. The window stopped at npm run live:voice with VOICE_POOL_INSUFFICIENT because DISCORD_VOICE_TOKENS has no entries in the owner .env. Stage 5 later replaced the development pin and six-relay default with the live Pages pin and four-relay default.

The historical voice smoke failure is superseded by credential-ready voice wiring and an honest degraded witness. The only held item is the owner-installed two-token DISCORD_VOICE_TOKENS pool. Portal intent approval and relay-set confirmation are not held. Text reflection works with privileged intents off through Gateway IDs plus REST content fetch. Owner-signed Discover publication and two-way text markers are already witnessed.

## 7. Dispatcher handoff

After the owner supplies the two-token DISCORD_VOICE_TOKENS pool and installs both bots, the dispatcher resumes this peer. No portal intent approval and no relay-set confirmation are needed. Rerun the final gated witness window on the new tree, fix only failures shown by that window, then push origin main once and quote the push output and git ls-remote origin main. Report DONE only when every done-section condition holds.

## 8. Current Stage 6 run status

What works now: control-plane Gateway login with the existing token, non-privileged guild/channel/message/reaction/typing/voice-state events, live Pages pin and four-relay runtime source, read-only live inventory, /health, structured degraded status and token redaction.

What is explicitly degraded: message-content enrichment, presence enrichment, member-list enrichment and per-user voice reflection. The first three remain opt-in and are not held for text reflection; Discord-origin text reflection works with privileged intents off through Gateway IDs plus REST content fetch. Per-user voice reflection requires at least two distinct DISCORD_VOICE_TOKENS bot tokens and real frames in both directions; no mixed-voice fallback is accepted.

What remains open: only the owner-installed two-token DISCORD_VOICE_TOKENS pool, the final gated live window after those credentials exist, and DONE. Portal intent approval, relay-set confirmation and owner key placement are not held. Do not poll for the held credentials; the dispatcher resumes when the owner-supplied fact changes.

## 9. Reversible new-snapshot reconciliation

The 174 extra Discord channels from the earlier live-serve probe are historical. The owner authorized cleaning up duplicate channels on both Discord and Zellous. npm run cleanup preserves canonical channel IDs, reports exact before/after counts and IDs, deletes only bridge-created duplicate Discord IDs, publishes owner-signed kind 5 deletion requests for duplicate relay snapshot events, publishes one deduped owner-author kind 30078 channel snapshot and writes cleanup-backup.json at mode 600. npm run cleanup:rollback republishes the previous snapshot and recreates deleted Discord channels with new IDs. npm run cleanup:red-check proves no canonical channel is deleted and no new duplicate appears after read-only startup. destructive cleanup is limited to bridge-created duplicates. npm run snapshot:reconcile still reads all current Discord channels, publishes a signed kind 30078 snapshot containing all of them, records the previous snapshot content and event id in data/snapshot-backup.json, and reports discordCount, zellousCount, duplicateNames, eventId, previousEventId and rollbackPath. npm run snapshot:rollback republishes the previous content as a newer replaceable event. npm run snapshot:red-check proves startup remains read-only and creates no Discord channels when the expected snapshot already exists.

## 10. Stage 7 owner key decision

Owner-signed metadata, Discover listing, roles, channel snapshot and kind 42 chat use BRIDGE_PRIVATE_KEY_HEX from .env. The owner placed the matching 64-hex key there; do not paste it into chat again. Because an nsec appeared in chat, key rotation remains an open note. Tests use a throwaway key. discover:publish and owner-signed live interaction are ready for the final witness window.

After the owner key is present: npm run discover:publish, npm run discover:query, npm run snapshot:reconcile, npm run snapshot:red-check and npm run serve:check prove owner-signed relays, exact counts, read-only startup and health. A browser/Discover DOM assertion must show the server card, joined channels and kind 42 chat before publication.

Open note: chat-exposed owner key rotation risk remains. The supplied 64-hex private key was used without echoing it; rotate later by replacing BRIDGE_PRIVATE_KEY_HEX and republishing the owner bundle.
## 11. Owner-authorized duplicate cleanup

Run npm run cleanup once. It preserves 21 canonical Discord channel IDs, deletes 481 bridge-created duplicate IDs, publishes a deduped owner-author kind 30078 channel snapshot, publishes owner-signed kind 5 deletion requests for duplicate relay snapshot events and writes cleanup-backup.json at mode 600. The command reports exact before/after Discord counts and IDs and relay event IDs. npm run cleanup:rollback restores the previous snapshot and recreates the deleted channels with new Discord IDs. npm run cleanup:red-check proves no canonical channel is deleted and no new duplicate appears after read-only startup. destructive cleanup is limited to bridge-created duplicates.
