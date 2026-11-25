# zellous-discord

A standalone bidirectional bridge between one Discord guild and one zellous server. It synchronizes room structure and messages, and reflects each voice participant as a distinct identity without mixing audio streams.

## Architecture

The service owns a Discord adapter, a wireweave-compatible Nostr adapter, a durable JSONL ledger, a reconciliation engine, a suppression ledger, and per-user voice workers. It does not modify the static zellous browser app.

Discord guild 367741339393327104 maps to one zellous server. Discord categories, text channels, announcement channels, forums, threads, stages and voice channels map one-to-one to zellous rooms or channels. Canonical envelopes carry source, source ID, operation, version and idempotency key. Replies, replay and echo suppression are ledgered.

Messages, reactions, attachments, corrections, deletions, typing, presence and profiles cross through explicit mappers. Nostr kind-42 messages stay immutable; Discord edits and deletions become explicit bridge corrections and best-effort delete requests.

Voice uses one worker per identity. Discord Opus receive streams and zellous WebRTC streams are routed per user. Distinct Discord bot tokens supply distinct Discord voice identities; the control token alone cannot provide multiple simultaneous voice identities in one guild.

## Quick start

Copy .env.example to .env and fill the control token, voice-token pool and relay values. Keep .env at mode 600. Enable the required Gateway intents and invite every bot to the guild. Then run npm ci, npm run check, npm run build and npm run serve.

## Verification

Use npm run witness:suite for local witnesses. Live commands are npm run live:inventory and npm run live:voice. The full final window is npm run full:window. docs/VERIFICATION.md lists every witness and red check.

## References

docs/PROTOCOL.md is the exact cross-system contract. docs/RESEARCH.md records the pinned source and live API facts. docs/SETUP.md and docs/DEPLOYMENT.md cover operation.