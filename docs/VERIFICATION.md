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
| New snapshot reconciliation | npm run snapshot:reconcile | Exact discordCount, zellousCount, duplicateNames, eventId, previousEventId and rollbackPath; no destructive cleanup |
| Snapshot startup red check | npm run snapshot:red-check | Expected snapshot exists; read-only startup creates zero Discord channels; health is degraded; PID cleanup leaves no orphan |
| Snapshot rollback | npm run snapshot:rollback | Previous snapshot content is republished as a newer replaceable event |