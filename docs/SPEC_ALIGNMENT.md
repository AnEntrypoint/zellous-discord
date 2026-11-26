# SPEC_ALIGNMENT.md

This document maps the changed facts checked, architecture and done sections of /config/workspace/hyperagent/specs/discord-bridge.md into the repository contract on 2026-11-26.

Current live GitHub Pages wireweave pin: 5d451241587181e471e263f44db993ba8e2d5764.
Earlier live pin: 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d; it is historical only.
Development pin: 4508d66ff4cd3fde31959cc8b998810f367be321.
The six-file protocol drift is reconciled in docs/LIVE_PIN_DIFF.md: src/hub-liveness.js, src/modules/voice-thread.js, src/vad/clip-filter.js, src/vad/detector.js, src/voice-thread-audio.js and src/voice.js.

The live four-relay default is wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol,wss://relay.snort.social. ZELLOUS_RELAYS is the optional override; NOSTR_RELAYS is a compatibility alias.

The earlier live-serve probe left 174 extra Discord channels in guild 367741339393327104. Those channels stay intact. Deleting or rewriting them is destructive outward cleanup and is not performed. The chosen reversible new-snapshot reconciliation publishes a signed kind 30078 channel snapshot containing all current Discord channels, records the previous relay event and content in data/snapshot-backup.json, and supports snapshot rollback with a newer replaceable event carrying the previous content. No Discord channel is created or deleted by this reconciliation.

The control-plane bridge runs with the existing .env token, DISCORD_PRIVILEGED_INTENTS=false by default, non-privileged Gateway intents, explicit degraded features in /health, real serve-health witnesses and PID cleanup. Startup reconciliation is read-only by default via LIVE_INVENTORY_MODE=read-only and ZDBRIDGE_READ_ONLY=1.

Publication remains held because the voice-token pool, privileged-intent approval, final gated window label zellous-discord-final-4 on tree cf8ff4a, one push, git ls-remote origin main agreement and DONE remain outstanding.

No destructive cleanup is performed on Discord channels by the reversible new-snapshot reconciliation.