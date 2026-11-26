# SETUP.md

1. Copy .env.example to .env and set DISCORD_TOKEN, DISCORD_VOICE_TOKENS and DISCORD_GUILD_ID. NOSTR_RELAYS already defaults to the live GitHub Pages relay set; set optional ZELLOUS_RELAYS only to override it. No owner relay-set confirmation remains.
2. Keep .env at mode 600. It is ignored by git and excluded from every witness.
3. Create one Discord application and bot user per voice identity. Put every voice bot token in DISCORD_VOICE_TOKENS as a comma-separated list. Invite each bot to guild 367741339393327104 with View Channel, Connect, Speak and Request to Speak.
4. Leave DISCORD_PRIVILEGED_INTENTS=false to run the control-plane bridge with GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING and GUILD_VOICE_STATES. Set it to true only after enabling MESSAGE_CONTENT, GUILD_PRESENCES and GUILD_MEMBERS in the Developer Portal. With the switch off, /health reports message-content, presence and member-list enrichment as degraded.
5. Run npm ci --ignore-scripts, npm run live:alignment, npm run alignment:red-check, npm run typecheck, npm run unit, npm run integration, npm run secret:scan, npm run build, npm run config:check, npm run intent:guard, npm run intent:red-check and npm run serve:check.
6. Run npm run snapshot:reconcile to publish a reversible snapshot of all current Discord channels. It leaves the 174 extra Discord channels intact and performs no destructive cleanup. npm run snapshot:rollback restores the previous snapshot content. npm run snapshot:red-check proves startup remains read-only. npm run serve is read-only by default because LIVE_INVENTORY_MODE=read-only; set LIVE_INVENTORY_MODE=reconcile only when writes are intended. Then run npm run health, npm run live:inventory and npm run live:voice.

The service generates its own persistent Nostr identity and writes it to the ignored data directory at mode 600. It never uses an owner personal key. Logs use structured redaction and never print secret values.

If DISCORD_VOICE_TOKENS has fewer than two entries, per-user voice reflection is degraded and live voice smoke fails with VOICE_POOL_INSUFFICIENT. This is an owner credential gap, not a skipped check. Mixed audio is never used as a substitute. /health reports voiceReflectionComplete false and per-user-voice-reflection in degradedFeatures.

Read docs/OPERATOR_RUNBOOK.md before supplying credentials or resuming the final window. It states the exact DISCORD_VOICE_TOKENS shape, privileged intents, per-bot permissions, chosen live relay default, optional ZELLOUS_RELAYS override, token redaction rules and the reason publication is held.

## Owner key for live Discover

Place the matching 64-hex private key for npub1nz90wez9p4cj3csw35csqnhmw9lazz4l6709wgjyvkrrmq2xsugsx4cz42 directly into the ignored .env as BRIDGE_PRIVATE_KEY_HEX. ZELLOUS_SERVER_OWNER_HEX is already set to 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711. Then run npm run discover:publish and npm run discover:query. Tests use a generated throwaway key and never print it. Because the owner nsec appeared in chat, rotate it if it is a production key.