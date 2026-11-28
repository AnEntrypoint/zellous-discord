# DONE_CHECK.md

Each Done condition of specs/discord-live-reflection.md read against live evidence on 2026-11-28 at about 19:10Z, service on a pushed tree, Pages serving wireweave 4b73168 and design f6df4dd. No condition is claimed done as a whole.

| Condition | State | Evidence |
|---|---|---|
| 1a Bridge live against guild 367741339393327104, owner-signed server on Discover | proven on relays, card render not witnessed | one service answering /health; discover:query RELAY_QUERY_PASS for kinds 34550 and 30078 signed by 988af764; the Discover dialog card itself was not read from the client |
| 1b Live client shows 247420 and the carried-over logo | proven | fresh-visitor source:truth: rail title 247420, rail img ca-rail-logo from the Discord guild icon URL, no Discord Bridge text; relay.primal.net and relay.snort.social serve it, nos.lol serves the old name and relay.damus.io is silent (warnings) |
| 1c Voice bridge visible | proven on both client lists, bot join proven one way | three voice channels under VOICE CHANNELS equal Discord's three; a Zellous join started the Discord bot and voice:bridge confirmed it with Discord's own voice state |
| 1d 21 canonical channels plus Rules in the client | open | client state holds 22, the rail lists 18; the four forum channels lack the inRail trait in zellous docs/js/modules/channel-types/index.js (docs/CLIENT_PATCH.md); the witness now fails on the short rail |
| 1e Join and chat | proven | ui:marker typed into the live client and reached Discord |
| 2 Text reaches the correct channel, no duplicates, echoes, unknown-root posts | proven | text:marker TEXT_REFLECTION_PASS and ui:marker UI_REFLECTION_PASS inference=1073958855979057162 warez=805320534370943016 wrongChannel=0 unknownRootPosts=0 duplicates=0 channelCount=21; channel-root:red-check pass |
| 3 Attribution both ways | proven | Discord to Zellous: attribution:witness read the live Zellous row showing the Discord username; Zellous to Discord: ui:marker asserts the visible username prefix in the Discord message |
| 4 Voice with real frames both ways, health ok | open | health degraded, VOICE_FRAMES_UNPROVEN, voiceReflectionComplete=false; no audio crosses; the Discord-join to Zellous-participant direction waits for a human in a Discord voice channel |
| 5 All witnesses and red checks pass | open | window A green on e0ee20d; live source:truth red on the short rail; held voice proof; snapshot, cleanup, channel-root, presence, secret and text and ui checks pass |
| 6 Public main equals local HEAD, no secret in history, .env mode 600 and ignored, cleanup reversible | proven | origin equals local after each push; SECRET_SCAN_PASS history=clean; .env mode 600 and ignored by .gitignore:1; CLEANUP_RED_CHECK_PASS and SNAPSHOT_RED_CHECK_PASS |
| 7 Dispatcher verification | not mine | |
