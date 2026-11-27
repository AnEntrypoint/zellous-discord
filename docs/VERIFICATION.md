# VERIFICATION.md

| Witness | Command | Red check |
|---|---|---|
| Install | npm ci --ignore-scripts | No secret appears in output; git check-ignore -v .env reports the ignore rule |
| Typecheck | npm run typecheck | TypeScript errors stop the window |
| Unit | npm run unit | Token-like fixture fails the scanner; duplicate canonical event creates no second room or message |
| Integration | npm run integration | Every mapped room type and mutation converges; delete-and-recreate, out-of-order replay, relay disconnect and Discord reconnect leave no duplicates or resurrection |
| Voice loopback | npm run integration | Distinct speaker identities pass in both directions with no cross-user mixing; mute or leave does not silence or relabel another speaker |
| Secret scan | npm run secret:scan and npm run secret:red-check | Worktree and history are clean; a token-like temporary fixture is detected |
| Build | npm run build | dist/cli.js and dist/voice/worker.js exist |
| Restart recovery | npm run restart:recovery | Two service PIDs start and stop cleanly; no orphan process remains |
| Startup reconciliation | npm run live:reconcile | A signed kind 30078 channel snapshot is accepted by at least one relay |
| Live inventory | npm run live:inventory | Discord and zellous room inventories have equal type, name, position, parent and topic |
| Live voice smoke | npm run live:voice | At least two voice identities join and produce distinct per-user stream evidence; a missing pool is a defect, not a skip |

The final window is npm run full:window. It prints ZDBRIDGE_DONE 0 only when every listed command succeeds. Push happens once, only after this window passes.
| Live pin and relay extraction | npm run live:alignment | Live Pages pin and four-relay default match repository constants; protocol diff has exactly the five reconciled changed files |
| Alignment red check | npm run alignment:red-check | Stale development pin, missing live relay default and unresolved protocol difference each fail |
| Config check | npm run config:check | Live default relays and ZELLOUS_RELAYS override both resolve correctly |
| Opt-in intent guard | npm run intent:guard | Default Gateway identify omits MESSAGE_CONTENT, GUILD_PRESENCES and GUILD_MEMBERS; opt-in includes them; degraded features are explicit |
| Intent red check | npm run intent:red-check | Disallowed-intent inclusion, hidden degradation and complete voice reflection without a pool each fail |
| Live serve health | npm run serve:check | Control-plane service starts with existing token, answers /health as degraded, lists degraded features, exposes no token and stops by PID |
| Spec alignment | npm run spec:alignment | Current pin, historical pin, six-file drift, 174 extra channels, reversible snapshot and opt-in intents are recorded in the contract |
| Spec red check | npm run spec:red-check | A stale fact fails |
| New snapshot reconciliation | npm run snapshot:reconcile | Exact discordCount, zellousCount, duplicateNames, eventId, previousEventId and rollbackPath; destructive cleanup is limited to owner-authorized bridge-created duplicates |
| Snapshot startup red check | npm run snapshot:red-check | Expected relay snapshot event exists; read-only startup creates zero Discord channels; health is degraded; PID cleanup leaves no orphan |
| Snapshot rollback | npm run snapshot:rollback | Previous snapshot content is republished as a newer replaceable event |

| Discover unit bundle | npm run unit | Throwaway key produces four owner-signed events with correct d tags, text/rules channels and increasing timestamps |
| Discover red check | npm run discover:red-check | Wrong pubkey listing, missing text/rules channel, missing metadata/listing/roles/channels and wrong server id fail |
| Owner bundle publication | npm run discover:publish | Four event ids and relay acceptance are reported with owner hex 988af764450d7128e20e8d31004efb717fd10abfd79e57224465863d81468711 |
| Relay event query | npm run discover:query | All four kinds exist on live relays with owner pubkey and increasing created_at |
| Kind 42 chat | npm run chat:post | e root equals SHA-256(serverId + ":" + channelId) and relay acceptance is reported |
| Live Discover DOM | browser assertion | Server card, joined channels and read/post chat are visible on live GitHub Pages || Cleanup red check | npm run cleanup:red-check, npm run cleanup:red-check -- --self-test | Canonical IDs remain, bridge duplicate IDs stay deleted, no duplicate key appears after read-only startup, health is degraded, token/key value is absent and PID cleanup leaves no orphan |
| Cleanup rollback path | npm run cleanup:rollback | cleanup-backup.json restores the previous relay snapshot and recreates deleted Discord channels with new IDs |

Open note: chat-exposed owner key rotation risk remains; the existing key is used without echoing it.

| Live two-way text marker | npm run text:marker | Unique Discord-origin marker appears as kind 42 with the correct e root and unique Zellous-origin marker appears in the mapped Discord channel; no duplicates, echoes, secret value or channel-count change |
| Text red check | npm run text:red-check, npm run text:red-check -- --self-test | Wrong root, missing marker, duplicate, secret value, hidden privileged-intent failure or changed channel count fails |
| Voice readiness red check | npm run voice:red-check, npm run voice:red-check -- --self-test | Frame isolation, distinct identities, token-count-only completion, hidden degradation and echo suppression fail |

| Held direction alignment | npm run spec:alignment, npm run spec:red-check | Portal intent approval and relay-set confirmation are not held; text reflection works with privileged intents off; only the two-token DISCORD_VOICE_TOKENS pool remains held |

| One-token voice readiness | npm run serve:check, npm run intent:guard, npm run live:voice, npm run voice:red-check | voiceTokenCount=1 reports VOICE_POOL_INSUFFICIENT rather than VOICE_POOL_ABSENT; voicePoolState=insufficient; voiceReflectionComplete=false; privilegedIntentsEnabled=false |
