# PENDING_VALIDATION.md

| Row | Commit scope | Files | Witness | Red check |
|---|---|---|---|---|
| 1 | foundation and project skeleton | .gitignore, .env.example, package.json, tsconfig.json, tsconfig.build.json, AGENTS.md, README.md | npm ci, npm run typecheck, npm run unit, npm run secret:scan, git check-ignore -v .env | Token-like fixture fails secret scan; duplicate canonical event creates no second room or message |
| 2 | protocol contract, typed config, redaction, durable ledger, idempotency, secret scanner and unit tests | src/*.ts, scripts/secret-scan.mjs, test/unit/*.test.ts, docs/PROTOCOL.md, docs/RESEARCH.md | npm ci, npm run typecheck, npm run unit, npm run secret:scan, npm run secret:red-check, git check-ignore -v .env | Duplicate canonical event creates no second room or message; token-like fixture fails secret scan |