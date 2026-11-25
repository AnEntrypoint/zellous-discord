# AGENTS.md

Work only in this standalone bridge repository. The zellous app and wireweave are read-only references.

The Discord token and every voice-pool token are secrets. Never place their values in source, docs, fixtures, logs, reports or command output. Use SecretString and the redacting logger.

Discord voice state permits one voice identity per bot user in a guild. Distinct simultaneous Discord voice identities require DISCORD_VOICE_TOKEN_1 through DISCORD_VOICE_TOKEN_N, each for a separate bot user invited to the guild with View Channel, Connect, Speak and Request to Speak.

The control bot needs Gateway intents GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING, GUILD_VOICE_STATES, GUILD_PRESENCES and GUILD_MEMBERS. Privileged intents must be enabled in the Developer Portal.

The zellous side uses the pinned wireweave commit 4508d66ff4cd3fde31959cc8b998810f367be321. Room hashes, Nostr kinds, tags, voice room IDs and relay defaults are recorded in docs/PROTOCOL.md and docs/RESEARCH.md.

Code has no comments. Put operating facts here and design rationale in docs.

Local commits are made as lanmower with no trailers. Phase A records every change in docs/PENDING_VALIDATION.md. Phase B runs one final witness window and pushes only if every listed check passes.