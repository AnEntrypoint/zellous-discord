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
| Live inventory | npm run live:inventory | Discord and zellous room inventories have equal type, name, position, parent and topic |
| Live voice smoke | npm run live:voice | At least two voice identities join and produce distinct per-user stream evidence; a missing pool is a defect, not a skip |

The final window is npm run full:window. It prints ZDBRIDGE_DONE 0 only when every listed command succeeds. Push happens once, only after this window passes.