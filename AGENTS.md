# AGENTS.md

Work only in this standalone bridge repository. The zellous app and wireweave are read-only references.

The Discord token and every voice-pool token are secrets. Never place their values in source, docs, fixtures, logs, reports or command output. Use SecretString and the redacting logger.

DISCORD_VOICE_TOKENS is a comma-separated pool. Each token belongs to a distinct Discord bot user invited to guild 367741339393327104 with View Channel, Connect, Speak and Request to Speak. A single bot user has one guild voice state, so N simultaneous Discord voice identities need N pool entries.

The control-plane bridge connects today with non-privileged intents GUILDS, GUILD_MESSAGES, GUILD_MESSAGE_REACTIONS, GUILD_MESSAGE_TYPING and GUILD_VOICE_STATES. DISCORD_PRIVILEGED_INTENTS is false by default; set it to true only after MESSAGE_CONTENT, GUILD_PRESENCES and GUILD_MEMBERS are enabled in the Developer Portal. With the switch off, message content, presence and member-list enrichment are explicitly degraded and /health reports them.

The zellous side imports the live GitHub Pages wireweave pin 5d451241587181e471e263f44db993ba8e2d5764 with injected nostrTools, xstate, storage, ws and a Node WebRTC polyfill. It uses the live four-relay default with optional ZELLOUS_RELAYS override. Development pin 4508d66ff4cd3fde31959cc8b998810f367be321 is development context reconciled in docs/LIVE_PIN_DIFF.md. Room hashes, Nostr kinds, tags, voice room IDs and relay defaults are recorded in docs/PROTOCOL.md and docs/RESEARCH.md.

Code has no comments. Put operating facts here and design rationale in docs.

npm install emits gitignore-fallback and skipped-integrity warnings for the pinned wireweave git dependency. These are packaging notices, not a bridge failure. npm ci --ignore-scripts avoids the esbuild postinstall notice. The discord.js transitive @sapphire/shapeshift deprecation notice is also external and not a bridge failure.

Local commits are made as lanmower with no trailers. Phase A records every change in docs/PENDING_VALIDATION.md. Phase B runs one final witness window and pushes only if every listed check passes.

The spec recorded live pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d, but a fresh live Pages read on 2026-11-26 resolved to 5d451241587181e471e263f44db993ba8e2d5764. Runtime follows the current live Pages artifact; docs/LIVE_PIN_DIFF.md records the drift and the done-section publication hold.

Startup reconciliation is read-only by default via LIVE_INVENTORY_MODE=read-only and ZDBRIDGE_READ_ONLY=1. Set LIVE_INVENTORY_MODE=reconcile only when external channel writes are intended; the first live serve probe showed that an empty mapping ledger plus two populated inventories can otherwise create duplicate Discord channels.