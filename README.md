# zellous-discord

A standalone bidirectional bridge between one Discord guild and one zellous server. It synchronizes room structure and messages, and reflects each voice participant as a distinct identity without mixing audio streams.

## Architecture

The service owns a Discord adapter, a wireweave-compatible Nostr adapter, a durable JSONL ledger, a reconciliation engine, a suppression ledger, and per-user voice workers. It imports the live GitHub Pages wireweave pin 5d451241587181e471e263f44db993ba8e2d5764 in Node with injected dependencies, uses the live four-relay default with optional ZELLOUS_RELAYS override, and does not modify the static zellous browser app.

Discord guild 367741339393327104 maps to one zellous server. Discord categories, text channels, announcement channels, forums, threads, stages and voice channels map one-to-one to zellous rooms or channels. Canonical envelopes carry source, source ID, operation, version and idempotency key. Replies, replay and echo suppression are ledgered.

Messages, reactions, attachments, corrections, deletions, typing, presence and profiles cross through explicit mappers. Nostr kind-42 messages stay immutable; Discord edits and deletions become explicit bridge corrections and best-effort delete requests.

Voice uses one worker per identity. Discord Opus receive streams and zellous WebRTC streams are routed per user. DISCORD_VOICE_TOKENS is a comma-separated pool of distinct bot tokens; the control token alone cannot provide multiple simultaneous voice identities in one guild.

## Quick start

Copy .env.example to .env and fill DISCORD_TOKEN, DISCORD_VOICE_TOKENS, BRIDGE_PRIVATE_KEY_HEX, the guild ID and relay values. Keep .env at mode 600. Privileged intents are opt-in through DISCORD_PRIVILEGED_INTENTS; the control-plane bridge runs with the switch off and reports degraded enrichment through /health. Then run npm ci, npm run check, npm run cleanup, npm run cleanup:red-check, npm run build and npm run serve.

## Verification

Use npm run witness:suite for local witnesses. Live alignment commands are npm run live:alignment and npm run alignment:red-check; spec and snapshot checks are npm run spec:alignment, npm run spec:red-check, npm run snapshot:reconcile and npm run snapshot:red-check; cleanup checks are npm run cleanup:red-check and npm run cleanup:red-check -- --self-test; opt-in switch checks are npm run intent:guard, npm run intent:red-check and npm run serve:check; live commands are npm run live:inventory and npm run live:voice. The full final window is npm run full:window. docs/VERIFICATION.md lists every witness and red check.

## References

docs/PROTOCOL.md is the exact cross-system contract. docs/RESEARCH.md records the pinned source and live API facts. docs/SETUP.md and docs/DEPLOYMENT.md cover operation.

## Live Discover owner key

Set BRIDGE_PRIVATE_KEY_HEX in the ignored .env to the 64-hex private key matching npub1nz90wez9p4cj3csw35csqnhmw9lazz4l6709wgjyvkrrmq2xsugsx4cz42. Then run npm run discover:publish, npm run discover:query and a browser/Discover DOM witness. Tests use a throwaway key; no key value belongs in source or reports. Open note: chat-exposed owner key rotation risk remains; the existing key is used without echoing it.
## Owner-authorized reversible duplicate cleanup

Run npm run cleanup once. It preserves canonical channels, deletes only bridge-created duplicates, writes cleanup-backup.json and reports exact before/after counts and IDs. npm run cleanup:rollback and npm run cleanup:red-check provide the rollback path and the red check. destructive cleanup is limited to bridge-created duplicates. Open note: chat-exposed owner key rotation risk remains; the existing key is used without echoing it.

## Live two-way reflection

Stage 2 maps Discord Gateway messages and wireweave per-message events into canonical channels, suppresses bridge echoes by stable native IDs and keeps read-only room guards. Run npm run text:red-check -- --self-test, npm run text:marker and npm run text:red-check. Stage 3 wires credential-ready per-user voice reflection into BridgeService; zero tokens remain honestly degraded and voiceReflectionComplete requires at least two identities plus real frames in both directions. Stage 1 is held only for owner-installed DISCORD_VOICE_TOKENS. Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off. Voice is not DONE.

With exactly one distinct DISCORD_VOICE_TOKENS entry, health and witnesses report an insufficient one-identity voice pool as VOICE_POOL_INSUFFICIENT, voiceTokenCount=1 and voicePoolState=insufficient. privilegedIntentsEnabled stays false and voiceReflectionComplete stays false. Voice is not DONE until a second distinct installed bot token and real two-way frames are proven.
