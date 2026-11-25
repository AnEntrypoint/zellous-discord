# AGENTS.md

Work only in this standalone bridge repository. The zellous app and wireweave are read-only references.

The Discord token and every voice-pool token are secrets. Never place their values in source, docs, fixtures, logs, reports or command output. Use SecretString and the redacting logger.

DISCORD_VOICE_TOKENS is a comma-separated pool. Each token belongs to a distinct Discord bot user invited to guild 367741339393327104 with View Channel, Connect, Speak and Request to Speak. A single bot user has one guild voice state, so N simultaneous Discord voice identities need N pool entries.

The control bot needs Gateway intents GUILDS, GUILD_MESSAGES, MESSAGE_CONTENT, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING, GUILD_VOICE_STATES, GUILD_PRESENCES and GUILD_MEMBERS. Privileged intents must be enabled in the Developer Portal.

The zellous side imports the live GitHub Pages wireweave pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d with injected nostrTools, xstate, storage, ws and a Node WebRTC polyfill. It uses the live four-relay default with optional ZELLOUS_RELAYS override. Development pin 4508d66ff4cd3fde31959cc8b998810f367be321 is development context reconciled in docs/LIVE_PIN_DIFF.md. Room hashes, Nostr kinds, tags, voice room IDs and relay defaults are recorded in docs/PROTOCOL.md and docs/RESEARCH.md.

Code has no comments. Put operating facts here and design rationale in docs.

npm install emits gitignore-fallback and skipped-integrity warnings for the pinned wireweave git dependency. These are packaging notices, not a bridge failure. npm ci --ignore-scripts avoids the esbuild postinstall notice. The discord.js transitive @sapphire/shapeshift deprecation notice is also external and not a bridge failure.

Local commits are made as lanmower with no trailers. Phase A records every change in docs/PENDING_VALIDATION.md. Phase B runs one final witness window and pushes only if every listed check passes.