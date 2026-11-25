# SETUP.md

1. Copy .env.example to .env and set DISCORD_TOKEN, DISCORD_VOICE_TOKENS, DISCORD_GUILD_ID and NOSTR_RELAYS.
2. Keep .env at mode 600. It is ignored by git and excluded from every witness.
3. Create one Discord application and bot user per voice identity. Put every voice bot token in DISCORD_VOICE_TOKENS as a comma-separated list. Invite each bot to guild 367741339393327104 with View Channel, Connect, Speak and Request to Speak.
4. Enable GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING, GUILD_VOICE_STATES, GUILD_PRESENCES and GUILD_MEMBERS for the control bot. MESSAGE_CONTENT, GUILD_PRESENCES and GUILD_MEMBERS are privileged intents.
5. Run npm ci --ignore-scripts, npm run typecheck, npm run unit, npm run integration, npm run secret:scan and npm run build.
6. Run npm run live:reconcile once to publish the deterministic Discord room snapshot to the configured relays. Then run npm run serve, npm run health, npm run live:inventory and npm run live:voice.

The service generates its own persistent Nostr identity and writes it to the ignored data directory at mode 600. It never uses an owner personal key. Logs use structured redaction and never print secret values.

If DISCORD_VOICE_TOKENS has fewer than two entries, live voice smoke fails with VOICE_POOL_INSUFFICIENT. This is an owner credential gap, not a skipped check. Mixed audio is never used as a substitute.

Read docs/OPERATOR_RUNBOOK.md before supplying credentials or resuming the final window. It states the exact DISCORD_VOICE_TOKENS shape, privileged intents, per-bot permissions, relay-set choice, token redaction rules and the reason publication is held.