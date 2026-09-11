# CLAUDE.md

> **Git policy — never auto-commit or auto-push.** Leave your work in the working tree.
> Run `git commit`, `git push`, `gh pr create`, or `scripts/push_all.sh` **only when the user
> explicitly asks in that turn**. Approval for an earlier change does not carry forward, and
> finishing a task is not permission to commit it.

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_api` (private, `BUSL-1.1`, v1.0.161) is the backend REST API for Sudojo, a Sudoku learning platform. It runs Hono on Bun and sits between the Sudojo clients and PostgreSQL, the C# solver service, the OCR ML service, Firebase Auth, and RevenueCat.

**Responsibilities:** content CRUD (levels 1–12, techniques 1–60, strategies, learning, communities), puzzles (boards, dailies with a fallback, challenges, technique examples/practices), solver proxy with hint point tracking, play sessions and gamification (points, badges, user level), user accounts (subscription lookup, soft delete), OCR, and optional AES-256-GCM encryption of `solution` fields.

Full route reference: **[docs/API.md](docs/API.md)**.

## Commands

**This project uses Bun exclusively.** Do not use npm, yarn, or pnpm.

```bash
bun install              # Install deps (CI/Docker write NPM_TOKEN to .npmrc first for @sudobility/*)
bun run dev              # bun --watch src/index.ts, port $PORT (default 3000)
bun run start            # bun run src/index.ts
bun run build            # bun build → dist/ (gitignored), target bun
bun run build:compile    # standalone executable dist/server
bun run typecheck        # tsc --noEmit
bun run lint             # eslint src   (scripts/ and tests/ are ignored)
bun run format           # prettier --write src
bun run format:check     # prettier --check src
bun run test             # Unit tests, vitest. Never touches a database; this is what CI runs.
bun run test:db          # Database tests (*.db.test.ts), vitest. MANUAL -- never run in CI.
                         # Requires TEST_DATABASE_URL pointing at localhost; refuses any other host.
bun run test:watch       # vitest watch (unit config)
bun run db:init          # Create/migrate tables (also runs automatically at server start)
bun run db:seed-badges   # Seed level_N / games_N badge definitions
bun run --inspect src/index.ts   # Start with the debugger
```

Verified on 2026-09-10 (Bun 1.3.10): `typecheck` (clean), `lint` (clean), `format:check` (clean), `test` (7 files, 287 tests pass), `bun build src/index.ts --target bun` (bundles). Not run: `dev`/`start` (long-running), `test:db`/`db:*` (need a database), `build:compile`.

**Never run bare `bun test`.** That is Bun's own runner: it ignores `vitest.config.ts` and the setup files, so the localhost `TEST_DATABASE_URL` guard never runs, and Bun auto-loads `.env`, which holds a remote `DATABASE_URL`. The `*.db.test.ts` helpers delete table contents.

## Architecture

```
clients (sudojo_app, sudojo_app_rn, sudojo_extension, sudojo_bot via @sudobility/sudojo_client or raw fetch)
   │  HTTPS  /api/v1/*   Authorization: Bearer <Firebase ID token>
   ▼
src/index.ts  Hono app: logger → cors → GET / and /health → encryptSolutionsMiddleware(/api/v1/*) → routes
   │            onError → 500 envelope, notFound → 404 envelope; exports { port, fetch, idleTimeout: 120 }
   ▼
src/routes/index.ts  mounts 15 routers (levels, techniques, strategies, learning, boards, dailies,
   │                  challenges, users, solver, examples, practices, play, gamification, ocr, communities)
   ├── middleware/auth.ts          adminMiddleware (token + SITEADMIN_EMAILS) on every admin write
   ├── middleware/firebaseAuth.ts  users/*, play/*, gamification/{stats,history}; rejects anonymous users
   ├── middleware/optionalAuth.ts  solver/solve only; optional token → firebaseUser, gates nothing
   ▼
db/ (Drizzle + postgres.js) ── PostgreSQL (DATABASE_URL)
services/solver-proxy.ts ── GET ${SOLVER_URL}/api/{solve,validate,generate}   (sudojo_solver, C#)
services/ocr-ml-proxy.ts ── POST ${OCR_ML_URL}/v1/ocr (sudojo_ocr_ml) → fallback Tesseract via @sudobility/sudojo_ocr
services/firebase.ts     ── @sudobility/auth_service (firebase-admin), initialized at import time
middleware/subscription.ts ── @sudobility/subscription_service (RevenueCat), lazily, only if REVENUECAT_API_KEY set
```

Startup: `src/index.ts` calls `initDatabase()` then `initGamificationTables()`. On failure the process exits. Bun starts serving from the default export without waiting for the schema init to finish.

## Repo Map

```
src/
├── index.ts               # Entry: middleware, health, error/404 handlers, DB init, SIGTERM/SIGINT shutdown
├── routes/                # 15 Hono routers + index.ts registry (see docs/API.md)
├── middleware/            # auth.ts, firebaseAuth.ts, optionalAuth.ts, subscription.ts, encryptSolutions.ts
├── services/              # solver-proxy.ts, ocr-ml-proxy.ts, firebase.ts
├── db/
│   ├── index.ts           # Lazy client, `db` proxy/getDb(), initDatabase() + initGamificationTables() raw SQL
│   ├── schema.ts          # Drizzle table definitions (must be kept in sync with the raw SQL by hand)
│   ├── init.ts            # `bun run db:init`
│   └── seed-badges.ts     # `bun run db:seed-badges`
├── schemas/index.ts       # All Zod request schemas
├── lib/                   # env-helper.ts, solution-crypto.ts, localization.ts (i18n string keys),
│                          # bitmask.ts (technique bitmask parse / SQL bind / response fields + types)
└── scripts/               # One-off community seeders (seed-communities*.ts, update-community-icons.ts)
scripts/                   # One-off data scripts, run with `bun run scripts/<name>.ts`; they write to DATABASE_URL
                           # (import-*, seed-levels-techniques, populate-*, backfill-board-difficulty,
                           #  export-technique-fixtures, reset-*, clear-examples-practices)
tests/
├── unit/                  # env-helper, schemas, bitmask, db-init (setup SQL vs Drizzle schema),
│                          # boards-route + bitmask-routes + solver-unrestricted (real routes over
│                          # fake-postgres.ts, a stub postgres.js client behind a real Drizzle
│                          # instance)  (bun run test)
├── *.db.test.ts           # Route tests against a real DB via app.fetch (bun run test:db)
├── setup.ts               # Unit setup: scrubDatabaseUrl() from @sudobility/test-db-guard
├── setup.db.ts            # DB setup: loads .env.test, setupTestDatabase() guard, vi.mock firebase
├── db-helpers.ts          # setupTestDatabase/cleanup/close, test tokens, getAuthHeaders
└── fixtures/technique-practices.json   # Written by scripts/export-technique-fixtures.ts
docs/API.md                # Route reference
plans/IMPROVEMENTS.md      # Improvement backlog (partly stale)
eng.traineddata            # Tesseract English model, read from the working directory by tesseract.js
Dockerfile                 # oven/bun:1 build (tsc check) → oven/bun:1-slim runtime, EXPOSE 8010
.github/workflows/ci-cd.yml  # Calls johnqh/workflows unified-cicd.yml
```

## Environment Variables

`getEnv()` (`src/lib/env-helper.ts`) reads `process.env` first, then a `.env.local` in the working directory, then the default. Bun auto-loads `.env` for `bun run`. Templates: `.env.example`, `.env.test.example`. Real `.env` and `.env.test` are gitignored and contain live credentials, so never print or copy them.

| Variable | Req. | Used by | Notes |
|----------|------|---------|-------|
| `DATABASE_URL` | yes | `db/index.ts`, scripts | Read lazily on first query |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | yes | `services/firebase.ts` | Read at **import** time. Importing any route without them throws |
| `SOLVER_URL` | yes | `services/solver-proxy.ts` | Read at import time, no default. Scripts default to `http://localhost:8080` |
| `PORT` | no | `index.ts` | Default `3000` (the Dockerfile EXPOSEs 8010, so set `PORT=8010` in the container) |
| `SOLVER_TIMEOUT_MS` | no | solver-proxy | Default `60000` |
| `SITEADMIN_EMAILS` | no | auth_service | Comma-separated admin emails. `ADMIN_EMAILS` is a legacy fallback used only when this is unset |
| `REVENUECAT_API_KEY` | no | subscription.ts | Read by `users.ts` only. Unset: `/users/:id/subscriptions` returns 500, and `DELETE /users/:id` skips the active-subscription check |
| `ADMIN_API_KEY` | no | optionalAuth.ts | On `solver/solve`, a matching `X-API-Key` header or `?api_key=` skips token verification and the caller is treated as anonymous. It no longer unlocks anything, because hints are unrestricted. Kept so behaviour stays the same. `sudojo_app_rn/scripts/record_technique.sh` sends it |
| `SOLUTION_ENCRYPTION_KEY` | no | solution-crypto.ts | 64 hex chars. Unset: solutions are sent in plaintext |
| `OCR_ML_URL`, `OCR_ML_TIMEOUT_MS` | no | ocr-ml-proxy.ts | Unset URL: Tesseract only. Timeout default `20000` |
| `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | no | firebase.ts | Apple token revocation on account delete. All four must be set |
| `TEST_DATABASE_URL` | tests | tests/setup.db.ts | Must use host exactly `localhost` (not `127.0.0.1`) |

`SOLVER_API_KEY` appears in `.env.example` and `.env.test.example`, but no code reads it.

## Auth & Access Model

| Layer | Where | Rule |
|-------|-------|------|
| Public | All content GETs, `solver/validate`, `solver/generate`, `ocr/extract`, `gamification/badges` | No auth |
| Admin | Every POST/PUT/DELETE on content, plus `boards/update-stats`, `practices/regenerate-hints` | `adminMiddleware`: valid token and admin email |
| User | `users/*` (own uid only), `play/*`, `gamification/stats|history` | `firebaseAuthMiddleware`, anonymous users → 403 |
| Optional | `solver/solve` | `optionalAuthMiddleware`: no token is fine, a valid token sets `firebaseUser` (hint points), a bad token → 401 `AUTH_TOKEN_INVALID` |

**Hint limits are deliberately not enforced or computed by the server.** Every caller, anonymous or free, gets every hint level from `solver/solve`. This is the owner's decision. The route-level check was removed in 4e8de9b (March 2026), and the code that still computed tiers (`hintAccess.ts`, `maxHintLevel`, `HINT_LEVEL_LIMITS` usage) and the unused daily-limit gate (`accessControl.ts`, `services/access.ts`) were then deleted. Don't reintroduce them as a "fix". `tests/unit/solver-unrestricted.test.ts` pins this behaviour. Clients gate hints themselves using each level's `entitlement` (seeded `blue_belt,red_belt` for levels 8–10, `red_belt` for 11–12) and `offer_id`. `@sudobility/sudojo_types` still exports `HINT_LEVEL_LIMITS` and `HintAccessDenied*`, and client code (`sudojo_client`, `sudojo_lib`, both apps) still handles a 402 `HINT_ACCESS_DENIED` and a 402 "Daily limit reached". The API never sends either.

## Gamification

- `POST /play/start` stores one `game_sessions` row per user (replacing any older one).
- A hint from `GET /solver/solve` whose `original` matches the active session awards `2 × hints.level` points right away and sets `hintUsed`.
- `POST /play/finish` computes `2^level × 10 (no hints) × 2 (not interrupted)`. Interrupted means the client-reported `elapsedTime` is more than 1s below server time. Perfect play raises `userLevel` and awards `level_<n>`. Milestone badges `games_<5…10000>` exist. Every change writes a `point_transactions` row.

## Database

- Schema lives in **two places**: raw `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS` SQL in `src/db/index.ts` (what actually runs), and Drizzle definitions in `src/db/schema.ts` (types and queries). `drizzle-kit` is installed but has no config and no migrations. Migrations are forward-only.
- Core tables: `levels`, `strategies` (17 seeded), `techniques`, `learning`, `boards`, `dailies`, `challenges`, `access_logs` (left over from the deleted daily-limit gate; still created, never written; `tests/db-helpers.ts` clears it), `technique_examples`, `technique_practices`, `communities`. Gamification tables: `user_stats` (includes `status` for soft delete), `badge_definitions`, `user_badges`, `game_sessions`, `point_transactions`.
- `initDatabase()` also seeds data idempotently: strategy rows, technique → strategy mappings, and level `entitlement`/`offer_id`. When you add a column, put the `ALTER` **after** the table's `CREATE` (commit 743dbc3 fixed a fresh-DB bootstrap break caused by that ordering).
- Technique bitmasks use bit `1n << BigInt(techniqueId)` (ids 1–60), so values exceed 2^53. `boards.techniques`, `dailies.techniques`, `technique_examples.techniques_bitfield` and `game_sessions.techniques` are `bigint({ mode: "bigint" })`: JS `bigint` in and out. `user_stats.total_points` is not a bitmask and stays `mode: "number"`. SQL counting uses `1::bigint << t`. See Conventions for the bitmask rules.

## Cross-Repo Contracts

| Sibling | Direction | Contract |
|---------|-----------|----------|
| `sudojo_solver` (C# `SudokuApi`) | API → solver | `GET ${SOLVER_URL}/api/solve?original&user&autopencilmarks&pencilmarks[&techniques]`, `/api/validate?original[&brutalForce]`, `/api/generate[?symmetrical]`. Envelope `{ success, error: {code,message}, data }`, where `code` is an integer 0–3 (`SolverErrorCode` in `solver-proxy.ts`), not a string. `/validate` and `/generate` `data.board` carries `techniques` (a JSON number, rounded above 2^53) and `techniques_bitmask` (the same ulong as a decimal string). Read it with `solverBitmask()`, which prefers the string and falls back to `String(techniques)` for older solvers. `hints.level === 0` means an auto-pencilmark hint. Technique ids 1–60 and levels 1–12 mirror `SudokuEngine/SudokuDefines.h` and `GetLevel`. `scripts/seed-levels-techniques.ts` and `backfill-board-difficulty.ts` follow its `difficulty_score` |
| `sudojo_ocr_ml` | API → ML | `POST ${OCR_ML_URL}/v1/ocr` `{ image, min_clues }` → `OCRExtractData` plus `debug`. 422 means too few clues |
| `@sudobility/sudojo_types` `^1.2.67` | dep | Response envelope helpers, all entity/response types, `EMPTY_BOARD`, `scrambleBoard`, `techniqueToBit`. New shared shapes go there first. The `_bitmask` response fields are not in the published version yet, so `src/lib/bitmask.ts` extends `Board` / `Daily` / `TechniqueExample` / `ValidateBoardData` locally with intersection types (`BoardResponse` etc., marked `TODO(sudojo_types)`). Its `techniqueToBit` / `addTechnique` / `hasTechnique` return or take JS numbers, so they are lossy for ids ≥ 54. Use `techniqueBit()` from `src/lib/bitmask.ts` instead |
| `@sudobility/sudojo_ocr` `^1.1.42` | dep | Tesseract pipeline (`extractSudokuFromImage`, `/node` canvas adapter) |
| `@sudobility/auth_service` `^1.1.21`, `@sudobility/subscription_service` `^1.0.23`, `@sudobility/types` `^1.9.67` | dep | Firebase verify/admin/delete, RevenueCat, `UserStatus`/`NONE_ENTITLEMENT` |
| `@sudobility/test-db-guard` `1.0.2` | devDep | `scrubDatabaseUrl()` / `setupTestDatabase()` localhost guard |
| `@sudobility/sudojo_client` | consumer | Typed endpoint map in `sudojo_client/src/network/sudojo-client.ts`. Keep it in sync when you add or rename routes |
| `sudojo_app` / `sudojo_app_rn` / `sudojo_extension` | consumers | Base URL `VITE_API_URL` / `EXPO_PUBLIC_API_URL` (default `https://api.sudojo.com`). The extension calls `/api/v1/ocr/extract` directly |
| All bitmask consumers | API → apps | Every bitmask response field is sent twice: `techniques` (number, lossy, kept for store builds) plus `techniques_bitmask` (exact decimal string), and `techniques_bitfield` plus `techniques_bitfield_bitmask`. Clients should read the string with `BigInt(...)`. Inputs (bodies, `/boards?techniques=&technique_bit=`) accept a number or a decimal string. Full table: [docs/API.md#technique-bitmasks](docs/API.md#technique-bitmasks) |
| `sudojo_bot` | consumer | `SOLVER_API_URL` (default `http://localhost:3000`) → `/api/v1/solver/solve`, `/validate` |
| i18n | consumers | Responses carry `localization` string keys (`levels.<n>.*`, `techniques.<path>.*`, `badges.<key>.*`, `learning.<path>.<i>`). Hint steps carry `{ text, title }`. Clients resolve these against their locale files (e.g. `sudojo_app/public/locales/*/`) |
| `sudojo_app/docs/communities.md` | input | Read by `src/scripts/seed-communities.ts` through a sibling-relative path |

## Testing

- **One test runner, two configs.** Everything is vitest. `bun run test` (`vitest.config.ts`) excludes `**/*.db.test.ts`, so a CI run cannot reach a database. `bun run test:db` (`vitest.db.config.ts`) collects only those files and is run by hand.
- **`TEST_DATABASE_URL`, not `DATABASE_URL`.** `tests/setup.db.ts` validates it points at exactly `localhost` (`127.0.0.1` is refused) before assigning `DATABASE_URL`. This replaced a `dbUrl.includes("_test")` substring check that passed for any database whose name contained "test".
- **`tests/setup.db.ts` loads `.env.test` itself**, because `bunfig.toml`'s `[test.env]` was Bun test-runner config that vitest ignores. It loads that file *only* -- never `.env`, which holds a remote `DATABASE_URL` -- and never overrides a variable already in the environment, so an explicitly exported `TEST_DATABASE_URL` wins over the file. Without that precedence the guard can never be exercised against a bad value.
- **Module mocks are `vi.mock` in `tests/setup.db.ts`**, converted from `bun:test`'s `mock.module`. `vi.mock` is hoisted, so the mock factories inline their string literals rather than referencing module-level consts -- a const would fail with "cannot access before initialization". Keep them in sync with `tests/db-helpers.ts`.
- **Test helpers live in `tests/db-helpers.ts`**, not the setup file. Setup files run for the whole suite; helpers are imported per test file.
- **`.env.test` is gitignored** because it holds live credentials. `.env.test.example` is the committed template.
- Only Firebase is mocked (`test-firebase-token` → admin `test@example.com`). The `vi.mock("../src/services/revenuecat")` factory targets a module that no longer exists, so subscription checks use whatever `REVENUECAT_API_KEY` is in `.env.test`.
- `solver*.db.test.ts` call a **live solver** at `.env.test`'s `SOLVER_URL` (template: `http://localhost:8080`). `setupTestDatabase()` wipes core tables once per file (`beforeAll`). `vitest.db.config.ts` sets `fileParallelism: false`.
- Both configs inline `@sudobility/auth_service` and `subscription_service` (`server.deps.inline`) because their extensionless ESM imports break Node's resolver.

## Conventions

- Validate every body and param with Zod from `src/schemas/index.ts` via `zValidator`. Query strings are parsed by hand in handlers.
- Respond with `successResponse()` / `errorResponse()`. Each route file `export default`s its `Hono` router, and you register it in `src/routes/index.ts`.
- Attach i18n keys through `src/lib/localization.ts` helpers, not literal strings.
- Technique bitmasks are `bigint` everywhere inside the API, and everything goes through `src/lib/bitmask.ts`. Parse input with `parseBitmask()` (the `bitmask` zod helper in `src/schemas/index.ts` uses it). Bind SQL with `bitmaskParam(value)`, which renders `$n::bigint` with a decimal-string param, never a JS number. Build bits with `techniqueBit(id)`. Pass every row with a bitmask column through `toBitmaskFields()` before `c.json`, because `JSON.stringify` throws on `bigint`. `toBitmaskFields()` emits `<field>` as a number and `<field>_bitmask` as the exact string. `tests/unit/bitmask-routes.test.ts` hits every such endpoint and fails if a `bigint` reaches a response.
- Env access goes through `getEnv` / `getRequiredEnv`, never `process.env` directly in `src/`.
- Prettier: double quotes, semicolons, width 80, 2 spaces, trailing commas `es5`, `arrowParens: avoid`, LF. ESLint: `no-unused-vars` ignores `^_`, `prefer-const`, `no-var`, `no-duplicate-imports`, `no-explicit-any` off.
- Commits are mostly `type: summary` or `type(scope): summary`. Releases bump `package.json` `version` (e.g. "bump version to 1.0.161").

## Deploy

CI (`.github/workflows/ci-cd.yml` → `johnqh/workflows/.github/workflows/unified-cicd.yml@main`) runs on pushes and PRs to `main`/`develop`. The steps are `bun install`, `typecheck`, `lint`, `test`, and `build`. On `main` only, it then builds the Dockerfile and pushes `<DOCKERHUB_USERNAME>/sudojo_api` tagged with the `package.json` version (`NPM_TOKEN` build arg for private packages). `develop` runs tests only, and there is no npm publish. The runtime image runs `bun run src/index.ts` from TS source and contains only `src/` and prod deps.

## Gotchas

- Dynamic filters: each `.where()` call on a Drizzle `$dynamic()` builder **replaces** the previous condition. Collect conditions in an array and call `.where(and(...conditions))` once. Wrap raw `sql` that contains `OR` in parentheses, because `and()` does not. (Fixed in `GET /boards`, which used to apply only the last of `level` / `technique_bit` / `techniques`; covered by `tests/unit/boards-route.test.ts`.)
- Bitmask columns are `mode: "bigint"`, so a new route that returns one of these rows without `toBitmaskFields()` fails at runtime with `TypeError: Do not know how to serialize a BigInt`. Add it to `tests/unit/bitmask-routes.test.ts`. The numeric `techniques` / `techniques_bitfield` response fields are still rounded above 2^53, which is deliberate for old store builds. Only `<field>_bitmask` is exact. `boards.techniques`, `dailies.techniques`, and `technique_examples.techniques_bitfield` are now created as `BIGINT`. They used to be created as `INTEGER`, which couldn't store bits ≥ 31. `initDatabase()` widens a leftover `INTEGER` column through `widenColumnToBigint()`, which does nothing once the column is `BIGINT`. `tests/unit/db-init.test.ts` fails if any Drizzle `bigint` column is created with another type.
- Hints are unrestricted by design (see Auth). There is no hint-tier or daily-limit code left. The `access_logs` table remains but is never written. Dropping it needs a migration decision.
- `/dailies/today` uses the UTC date. A missing daily returns an unpersisted scrambled board with `uuid: "fallback-<date>"`.
- `GET` responses under `/api/v1` are re-serialized by the encryption middleware whenever a key is set. Clients must decrypt `enc:` values.
- Health `version` is hard-coded `"1.0.0"`. `/health` does not check the DB.
- Scripts in `scripts/` and `src/scripts/` write to whatever `DATABASE_URL` resolves to, and Bun loads `.env` (remote). `update-technique-dependencies.ts` says to run with `bunx tsx`.
- `eng.traineddata` is not copied into the Docker image. A container falls back to tesseract.js's default language download on the first Tesseract OCR call.
- `.claude/settings.local.json` is committed even though `.gitignore` lists it.

## Common Tasks

### Add an endpoint
1. Add a handler to `src/routes/<module>.ts` (or create a module and register it in `src/routes/index.ts`).
2. Add Zod schemas in `src/schemas/index.ts` and unit cases in `tests/unit/schemas.test.ts`.
3. Apply `adminMiddleware` / `firebaseAuthMiddleware` as appropriate.
4. Add shared response types to `@sudobility/sudojo_types`, and add the path to `sudojo_client`'s endpoint map.
5. Update `docs/API.md`.

### Add a table or column
1. Add the Drizzle definition in `src/db/schema.ts`. A technique bitmask column is `bigint({ mode: "bigint" })`, its name goes in `BITMASK_FIELDS` in `src/lib/bitmask.ts`, and its responses go through `toBitmaskFields()`.
2. Add the raw SQL in `src/db/index.ts` (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, placed after the table's CREATE).
3. `bun run db:init` applies it (so does any server start).

## Git Workflow

- Do not use feature branches for code changes. Always stay on the current branch.
