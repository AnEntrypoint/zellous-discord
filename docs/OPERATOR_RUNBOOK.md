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

Enable these intents on the control bot in the Developer Portal and in its Gateway identify payload: GUILDS 1<<0, GUILD_VOICE_STATES 1<<7, GUILD_MESSAGES 1<<9, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING, GUILD_MEMBERS 1<<1, GUILD_PRESENCES 1<<8 and MESSAGE_CONTENT 1<<15.

The privileged intents are GUILD_MEMBERS, GUILD_PRESENCES and MESSAGE_CONTENT. They must be toggled for the app; MESSAGE_CONTENT also needs approval after verification. GUILD_PRESENCES and GUILD_MEMBERS are off by default on all API versions.

## 4. Relay-set choice

The default relay set is the pinned wireweave default encoded in NOSTR_RELAYS: wss://relay.primal.net,wss://nos.lol,wss://offchain.pub,wss://nostr-pub.wellorder.net,wss://relay.snort.social,wss://relay.damus.io.

The owner must either confirm this default set or provide a replacement NOSTR_RELAYS value as a comma-separated list of wss URLs. The startup reconciliation publishes a signed kind 30078 channel snapshot to this set; live inventory reads it back. A relay set that rejects the snapshot or returns a stale inventory stops the final window.

## 5. Token redaction rules

The owner edits /config/workspace/zellous-discord/.env directly and keeps it at mode 600. Do not paste token values into chat, the spec, a transcript, a log, a report, a commit, a fixture or test output. The dispatcher should relay only that the credentials were supplied, not the values.

.env is ignored and excluded from every commit. Secret values are wrapped in SecretString, redacted by the structured logger, scanned in the worktree and git history by scripts/secret-scan.mjs, and omitted from .env.example. The scanner self-test injects a token-like temporary fixture and must fail that scan. A real token-like string appearing in a committed file is a publication-stopping defect.

## 6. Why publication is held

The final gated witness window zellous-discord-final-3 ended with ZDBRIDGE_DONE 1. Local witnesses passed, live reconciliation was accepted by four of six relays, and live inventory reported discordCount 21, zellousCount 21, no missing rooms and no mismatches. The window stopped at npm run live:voice with VOICE_POOL_INSUFFICIENT because DISCORD_VOICE_TOKENS has no entries in the owner .env.

Per the spec red check, a missing token or failed check stops publication. There was no push, no pushed SHA, no git ls-remote origin main agreement and no DONE report. All commits remain local on main.

## 7. Dispatcher handoff

After the owner supplies the pool, installs the bots, enables the privileged intents and confirms or replaces the relay set, the dispatcher resumes this peer. Rerun the final gated witness window on the new tree, fix only failures shown by that window, then push origin main once and quote the push output and git ls-remote origin main. Report DONE only when every done-section condition holds.