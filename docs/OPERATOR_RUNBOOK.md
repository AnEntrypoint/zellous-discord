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

The privileged intents are GUILD_MEMBERS, GUILD_PRESENCES and MESSAGE_CONTENT. They are opt-in because requesting them without portal approval closes the Gateway with Used disallowed intents. MESSAGE_CONTENT also needs approval after verification. With the switch off, /health reports message-content, presence and member-list enrichment as degraded.

## 4. Relay-set choice

The dispatcher chose the live GitHub Pages default relay set as the source of truth: wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. NOSTR_RELAYS carries this default. ZELLOUS_RELAYS is an optional comma-separated wss override. No owner relay-set confirmation remains.

The startup reconciliation publishes a signed kind 30078 channel snapshot to the chosen set; live inventory reads it back. A relay set that rejects the snapshot or returns a stale inventory stops the final window.

## 5. Token redaction rules

The owner edits /config/workspace/zellous-discord/.env directly and keeps it at mode 600. Do not paste token values into chat, the spec, a transcript, a log, a report, a commit, a fixture or test output. The dispatcher should relay only that the credentials were supplied, not the values.

.env is ignored and excluded from every commit. Secret values are wrapped in SecretString, redacted by the structured logger, scanned in the worktree and git history by scripts/secret-scan.mjs, and omitted from .env.example. The scanner self-test injects a token-like temporary fixture and must fail that scan. A real token-like string appearing in a committed file is a publication-stopping defect.

## 6. Why publication is held

The final gated witness window zellous-discord-final-3 ended with ZDBRIDGE_DONE 1. Local witnesses passed, historical live reconciliation was accepted by four of six development relays, and live inventory reported discordCount 21, zellousCount 21, no missing rooms and no mismatches. The window stopped at npm run live:voice with VOICE_POOL_INSUFFICIENT because DISCORD_VOICE_TOKENS has no entries in the owner .env. Stage 5 later replaced the development pin and six-relay default with the live Pages pin and four-relay default.

Per the spec red check, a missing token or failed check stops publication. There was no push, no pushed SHA, no git ls-remote origin main agreement and no DONE report. All commits remain local on main. Stage 6 later made privileged enrichment opt-in and started the control-plane bridge with the existing token; /health reports status degraded with the exact degraded feature list.

## 7. Dispatcher handoff

After the owner supplies the pool, installs the bots and enables the privileged intents, the dispatcher resumes this peer. No relay-set confirmation is needed. Rerun the final gated witness window on the new tree, fix only failures shown by that window, then push origin main once and quote the push output and git ls-remote origin main. Report DONE only when every done-section condition holds.

## 8. Current Stage 6 run status

What works now: control-plane Gateway login with the existing token, non-privileged guild/channel/message/reaction/typing/voice-state events, live Pages pin and four-relay runtime source, read-only live inventory, /health, structured degraded status and token redaction.

What is explicitly degraded: message-content enrichment, presence enrichment, member-list enrichment and per-user voice reflection. The first three become available only after portal approval and DISCORD_PRIVILEGED_INTENTS=true. Per-user voice reflection requires at least two distinct DISCORD_VOICE_TOKENS bot tokens and the final gated window; no mixed-voice fallback is accepted.

What remains open: owner-supplied voice-token pool, final gated window label zellous-discord-final-4 on tree 8889615 with GATE_TREE=8889615, one push, git ls-remote origin main agreement and DONE. Do not poll for these; the dispatcher resumes when the owner-supplied fact changes.

## 9. Reversible new-snapshot reconciliation

The 174 extra Discord channels from the earlier live-serve probe stay intact. No destructive cleanup is performed. npm run snapshot:reconcile reads all current Discord channels, publishes a signed kind 30078 snapshot containing all of them, records the previous snapshot content and event id in data/snapshot-backup.json, and reports discordCount, zellousCount, duplicateNames, eventId, previousEventId and rollbackPath. npm run snapshot:rollback republishes the previous content as a newer replaceable event. npm run snapshot:red-check proves startup remains read-only and creates no Discord channels when the expected snapshot already exists.

## 10. Stage 7 owner key decision

Owner-signed metadata, Discover listing, roles, channel snapshot and kind 42 chat need BRIDGE_PRIVATE_KEY_HEX in .env. The owner must place the 64-hex key directly into .env; do not paste it into chat again. Because an nsec appeared in chat, treat it as exposed and decide whether to rotate it before use. Until then, discover:publish and owner-signed live interaction remain held; tests use a throwaway key.

After the owner key is present: npm run discover:publish, npm run discover:query, npm run snapshot:reconcile, npm run snapshot:red-check and npm run serve:check prove owner-signed relays, exact counts, read-only startup and health. A browser/Discover DOM assertion must show the server card, joined channels and kind 42 chat before publication.