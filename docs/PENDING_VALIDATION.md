# PENDING_VALIDATION.md

| Row | Commit scope | Files | Witness | Red check |
|---|---|---|---|---|
| 1 | foundation and project skeleton | .gitignore, .env.example, package.json, tsconfig.json, tsconfig.build.json, AGENTS.md, README.md | npm ci, npm run typecheck, npm run unit, npm run secret:scan, git check-ignore -v .env | Token-like fixture fails secret scan; duplicate canonical event creates no second room or message |