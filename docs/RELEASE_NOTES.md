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

The bridge now imports the live GitHub Pages wireweave pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d, uses the live four-relay default wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social, and supports optional ZELLOUS_RELAYS override. NOSTR_RELAYS remains a compatibility alias. The protocol contract records the five changed live-pin files and the added relay, streamId, src, muteMs, unmuteMs, fragment, clipSpliced, relayed and remoteKeys fields. The dispatcher chose the live values; no owner relay-set confirmation remains. The Social SDK provisional-account endpoint is unavailable, so DISCORD_VOICE_TOKENS remains required. Publication is still held only for owner voice tokens; no final window rerun or push occurred in Stage 5.