# zellous-discord

A standalone bidirectional bridge between one Discord guild and one zellous server. It synchronizes room structure and messages, and reflects each voice participant as a distinct identity without mixing audio streams.

## Architecture

The service owns a Discord adapter, a wireweave-compatible Nostr adapter, a durable JSONL ledger, a reconciliation engine, a suppression ledger, and per-user voice workers. It imports the live GitHub Pages wireweave pin 5d451241587181e471e263f44db993ba8e2d5764 in Node with injected dependencies, uses the live four-relay default with optional ZELLOUS_RELAYS override, and does not modify the static zellous browser app.

Discord guild 367741339393327104 maps to one zellous server. Discord categories, text channels, announcement channels, forums, threads, stages and voice channels map one-to-one to zellous rooms or channels. Canonical envelopes carry source, source ID, operation, version and idempotency key. Replies, replay and echo suppression are ledgered.

Messages, reactions, attachments, corrections, deletions, typing, presence and profiles cross through explicit mappers. Nostr kind-42 messages stay immutable; Discord edits and deletions become explicit bridge corrections and best-effort delete requests.

Voice uses one worker per identity. Discord Opus receive streams and zellous WebRTC streams are routed per user. DISCORD_VOICE_TOKENS is a comma-separated pool of distinct bot tokens; the control token alone cannot provide multiple simultaneous voice identities in one guild.

## Quick start

Copy .env.example to .env and fill DISCORD_TOKEN, DISCORD_VOICE_TOKENS, the guild ID and relay values. Keep .env at mode 600. Privileged intents are opt-in through DISCORD_PRIVILEGED_INTENTS; the control-plane bridge runs with the switch off and reports degraded enrichment through /health. Then run npm ci, npm run check, npm run build and npm run serve.

## Verification

Use npm run witness:suite for local witnesses. Live alignment commands are npm run live:alignment and npm run alignment:red-check; spec and snapshot checks are npm run spec:alignment, npm run spec:red-check, npm run snapshot:reconcile and npm run snapshot:red-check; opt-in switch checks are npm run intent:guard, npm run intent:red-check and npm run serve:check; live commands are npm run live:inventory and npm run live:voice. The full final window is npm run full:window. docs/VERIFICATION.md lists every witness and red check.

## References

docs/PROTOCOL.md is the exact cross-system contract. docs/RESEARCH.md records the pinned source and live API facts. docs/SETUP.md and docs/DEPLOYMENT.md cover operation.