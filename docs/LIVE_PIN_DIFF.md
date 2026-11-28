# LIVE_PIN_DIFF.md

Live GitHub Pages source of truth: https://anentrypoint.github.io/zellous/

Current live wireweave pin: f944146955ca886370f3de464865f311998cb25b.
Previous live wireweave pin: 5d451241587181e471e263f44db993ba8e2d5764.
Earlier spec live pin: 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d.
Development wireweave pin: 4508d66ff4cd3fde31959cc8b998810f367be321.
All four pins report wireweave version 0.3.64.

The live Pages nostr-chat import map currently pins wireweave to f944146955ca886370f3de464865f311998cb25b. The live Pages wireweave-bridge still passes state.nostrRelays or the default set wss://relay.damus.io, wss://relay.primal.net, wss://nos.lol, wss://relay.snort.social to createWireweave. The dispatcher chose the live Pages artifact and four-relay default as the bridge source of truth. ZELLOUS_RELAYS is an optional comma-separated override. NOSTR_RELAYS remains a compatibility alias. No owner relay-set confirmation remains.

The spec recorded live pin 2e364df5f45b29e8f5cf6e747a0c2e9781352e0d, but a fresh live Pages read on 2026-11-26 resolved to 5d451241587181e471e263f44db993ba8e2d5764, a cache-busting live Pages read on 2026-11-27 resolved to 8a4a5002d878e6f849068106a92339f0f6be02dc, and a live Pages read on 2026-11-28 resolved to f944146955ca886370f3de464865f311998cb25b. Runtime follows the current live Pages artifact. The earlier pins are historical only; docs/SPEC_ALIGNMENT.md records the drift and publication is no longer held for that document.

The Social SDK provisional-account endpoint POST /partner-sdk/token/bot returned HTTP 404 with Discord API code 10002 for this application. Provisional accounts are unavailable, and the dedicated DISCORD_VOICE_TOKENS pool remains required. No mixed-voice fallback is permitted.

GitHub tree comparison between the development pin and the current live pin shows exactly six changed src files. GitHub comparison from previous live pin 5d451241587181e471e263f44db993ba8e2d5764 to the 2026-11-27 live pin 8a4a5002d878e6f849068106a92339f0f6be02dc shows exactly one changed src file, src/voice.js, with 119 additions and 18 deletions for late joiner and same-pubkey rejoin handling. GitHub comparison from 8a4a5002d878e6f849068106a92339f0f6be02dc to the 2026-11-28 live pin f944146955ca886370f3de464865f311998cb25b changes exactly src/unread.js and no protocol file. No changes appear in channel-hex.js, channels.js, chat.js, reactions.js, presence.js, media.js, servers.js, relay-pool.js, dtag.js, wireweave.js or index.js. Therefore all room hashes, kind 34550 server metadata, kind 30078 channel snapshots, kind 42 messages, kind 5 deletions, kind 7 reactions, kind 0 profiles, kind 20042 typing, kind 30078 presence, d tag prefixes and p/r voice-signal tags remain identical.

Voice signaling remains replaceable kind 30078. Presence still uses d tag zellous-voice:roomId with action, channel and server tags. Offer, answer and ice still use d tag zellous-rtc:roomId:fromPubkey:toPubkey:type:sequence with p and r tags and JSON content carrying type and data. The current live pin adds hub-liveness heartbeats, relays maps, hub claims, uplinkClass, SFU seen and suspect maps, route timers and relayMap/relayTxs state. The previous-to-current drift adds PRESENCE_LAPSE_MS, latched claims, join-epoch claims, reborn close, connected-only prune, bye fingerprint and gather-stall recreate. No room, message, reaction, typing, presence, profile, channel-snapshot or relay-pool protocol file changed in that drift. The relay signal type still uses the same kind-30078 envelope with streamId and src in the data payload.

## Reconciled changed files

src/hub-liveness.js reconciled: hub silence floor and ceiling, stall gaps, heartbeat and transport-byte evidence, jitter decay, thresholdMs and linkAlive are captured as hubLiveness, hbAt, netAt, jitter, linkAlive, hb, presenceLiveMs, suspect and seen fields.

src/modules/voice-thread.js reconciled: hasVoiced became hasPlayable; hole holding and recheck scheduling were added; clip PCM splice handling now uses decodeClipPcm, ring.splice, clip-spliced events and segment muteMs and unmuteMs; the current pin passes unmuteMs into ring.splice; taps open remoteKeys when available; segment-received reports from segment.from.

src/vad/clip-filter.js reconciled: FRAGMENT_MIN_VOICED_MS is 100; applyThresholds and judgeClip accept a fragment option; fragment clips bypass the full voiced-ratio, energy, pitch and periodicity checks.

src/vad/detector.js reconciled: assess accepts an options object and forwards it to judgeClip, enabling fragment assessment for outbound live-pin clips.

src/voice-thread-audio.js reconciled: PcmRing gained follow-tail, hole-hold, hole-recheck, splice and alignment constants; the current pin adds pickHole, splice margins, lastFilled and hole matching by unmuteMs minus muteMs; frames carry digital-silence and timestamp fields; silentRuns, splice and decodeClipPcm support the live clip-splicing path.

src/voice.js reconciled: peers and relayed are separate maps; remoteKeys and getRemoteStream cover relayed peers; outbound capture has release, start-delay and post-roll timing; segment metadata carries muteMs and unmuteMs; clipVad.assess receives fragment true; _broadcastSegment accepts exceptPk and the hub rebroadcasts relayed segments; a relay WebRTC signal carries streamId and src; setDeafened covers peers and relayed; the current pin adds hub-liveness heartbeat data channel messages, relays maps, hub and uplinkClass presence fields, presenceLiveMs expiry, SFU seen/suspect/routeTimer/routeFor/myClass state and relayMap/relayTxs. The current pin also adds latched claims, join-epoch claims, reborn close, connected-only prune, bye fingerprint and gather-stall recreate for late joiners and same-pubkey rejoins.

The bridge contract now names relay, streamId, src, muteMs, unmuteMs, fragment, clipSpliced, relayed, remoteKeys, hb, relays, hub, uplinkClass, presenceLiveMs, hubLiveness, linkAlive, hbAt, netAt, jitter, suspect, seen, routeTimer, routeFor, myClass, calmAt, claim, cls, relayMap and relayTxs in VOICE_FIELDS and VoiceSignal. The protocol diff red check fails if the GitHub tree introduces any other changed protocol file or if any changed file lacks its reconciled entry. The live alignment witness fails on a stale previous live pin in a runtime, test or lock file.