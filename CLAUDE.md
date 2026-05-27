# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_api` is the backend REST API for Sudojo, a Sudoku learning platform. Built with Hono framework on Bun runtime, it is the ecosystem backbone connecting frontend apps with the database, solver engine, Firebase auth, and RevenueCat subscriptions.

**Key responsibilities:**
- Puzzle management (levels 1–12, daily puzzles, challenges, practice boards)
- Learning content (technique explanations, theory, guided learning paths)
- Game sessions & gamification (point tracking, badge systems, user stats)
- User management (Firebase auth, subscription tier gating, profiles)
- Solver proxy (hints, validation, puzzle generation via external solver service)
- OCR integration (image-to-puzzle extraction via Tesseract.js)
- Solution encryption (AES-256-GCM for response payloads)

## Runtime & Package Manager

**This project uses Bun exclusively.** Do not use npm, yarn, or pnpm.

```bash
bun install              # Install dependencies
bun run dev              # Start dev server with hot reload (--watch)
bun run start            # Start production server
bun run build            # Bundle for production (bun build)
bun run build:compile    # Create standalone executable
bun run test             # Run unit tests (vitest)
bun run test:unit        # Run unit tests (vitest)
bun run test:integration # Run integration tests (bun:test, requires .env.test)
bun run typecheck        # Type-check without emitting
bun run lint             # Run ESLint
bun run format           # Format with Prettier
bun run format:check     # Check formatting
bun run db:init          # Create/migrate database tables
bun run db:seed-badges   # Seed badge definitions
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | Bun |
| **Framework** | Hono 4.x |
| **Language** | TypeScript 5.9 (strict mode) |
| **Database** | PostgreSQL + Drizzle ORM 0.45 |
| **Validation** | Zod 4.x + @hono/zod-validator |
| **Auth** | Firebase Admin SDK 13.x |
| **Subscriptions** | RevenueCat via @sudobility/subscription_service |
| **OCR** | Tesseract.js 5.x + @napi-rs/canvas |
| **Testing** | Vitest (unit) + bun:test (integration) |
| **Containerization** | Docker (multi-stage, oven/bun:1 base) |

## Project Structure

```
src/
├── index.ts              # App entry point, Hono setup, graceful shutdown
├── routes/               # API route handlers (~13 files)
│   ├── index.ts          # Route registry
│   ├── levels.ts         # Difficulty levels CRUD (1-12)
│   ├── techniques.ts     # Solving techniques CRUD (60 techniques)
│   ├── learning.ts       # Learning content CRUD
│   ├── boards.ts         # Puzzle board CRUD + filters
│   ├── dailies.ts        # Daily puzzles with fallback generation
│   ├── challenges.ts     # Challenge puzzles CRUD
│   ├── practices.ts      # Technique practice puzzles
│   ├── examples.ts       # Technique examples
│   ├── users.ts          # User info, subscriptions
│   ├── play.ts           # Game session management, points, badges
│   ├── solver.ts         # Solver proxy (hints, validation, generation)
│   ├── gamification.ts   # Stats, badges, leaderboards
│   └── ocr.ts            # Image-to-puzzle extraction
├── db/
│   ├── index.ts          # Database connection (Drizzle + postgres.js)
│   ├── schema.ts         # Drizzle ORM table definitions
│   ├── init.ts           # Idempotent table creation & migrations
│   └── seed-badges.ts    # Badge seeding script
├── middleware/
│   ├── auth.ts           # Admin authentication (checks SITEADMIN_EMAILS)
│   ├── firebaseAuth.ts   # Firebase ID token verification
│   ├── subscription.ts   # RevenueCat subscription helper
│   ├── hintAccess.ts     # Hint level gating by subscription tier
│   ├── accessControl.ts  # Access control utilities
│   └── encryptSolutions.ts # AES-256-GCM encryption of solution fields
├── services/
│   ├── firebase.ts       # Firebase auth wrapper
│   ├── solver-proxy.ts   # External solver service caller
│   └── access.ts         # Access control helpers
├── schemas/
│   └── index.ts          # Zod validation schemas for all routes
├── lib/
│   ├── env-helper.ts     # Environment variable resolution
│   ├── solution-crypto.ts # AES-256-GCM encryption/decryption
│   └── localization.ts   # i18n string key generation
tests/
├── setup.ts              # Test database setup, fixtures, mocks
├── types.ts              # Test type definitions
└── *.test.ts             # Integration tests
```

## API Structure

**Base Path**: `/api/v1`

| Route Prefix | Purpose | Auth |
|-------------|---------|------|
| `/levels` | Difficulty levels (1-12) CRUD | Admin for writes |
| `/techniques` | Solving techniques (60) CRUD | Admin for writes |
| `/learning` | Theory/instructional content CRUD | Admin for writes |
| `/boards` | Puzzle board CRUD (filter by level, technique) | Admin for writes |
| `/dailies` | Daily puzzles (`/today`, `/:date`, `/uuid/:uuid`) | Admin for writes |
| `/challenges` | Challenge puzzles (`/random`) | Admin for writes |
| `/practices` | Technique practice puzzles (`/counts`, `/technique/:t/random`) | Admin for writes |
| `/examples` | Technique examples | Admin for writes |
| `/users` | User profile & subscriptions | Firebase auth |
| `/play` | Game sessions (`/start`, `/finish`, `/stats`) | Firebase auth |
| `/solver` | Solver proxy (`/solve`, `/validate`, `/generate`) | Hint access gating |
| `/gamification` | Stats, badges, point history | Firebase auth |
| `/ocr` | Image-to-puzzle extraction | Firebase auth |

Health checks: `GET /` and `GET /health`

**Response shape**: `{ success: boolean, data?: T, error?: string }` via `successResponse()` / `errorResponse()` from `@sudobility/sudojo_types`.

## API Patterns

### Route Definition
```typescript
const router = new Hono();

router.get('/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
  const { id } = c.req.valid('param');
  const rows = await db.select().from(table).where(eq(table.id, id));
  return c.json(successResponse(rows[0]));
});
```

### Authentication Layers
- **Public**: No auth required (health, level list, board list)
- **Firebase auth**: `firebaseAuthMiddleware` sets `userId`, `userEmail`, `siteAdmin` on context
- **Admin**: `adminMiddleware` checks email against `SITEADMIN_EMAILS`
- **Subscription gating**: `hintAccessMiddleware` computes `maxHintLevel` based on RevenueCat entitlements

### Subscription Tiers
- **Free**: Max hint level 2
- **Blue Belt**: Max hint level 5 (requires `blue_belt` entitlement)
- **Red Belt**: Unlimited hints (requires `red_belt` entitlement)
- Site admins get unlimited regardless of subscription

### Database Queries
```typescript
import { db } from '../db';
import { boards } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

// Simple query
const rows = await db.select().from(boards).where(eq(boards.uuid, uuid));

// Dynamic query building
let query = db.select().from(boards).$dynamic();
if (levelParam) query = query.where(eq(boards.level, level));
if (techniqueBit) query = query.where(sql`(${boards.techniques} & ${bit}) != 0`);
```

### Solution Encryption
GET responses optionally encrypt `solution` fields with AES-256-GCM when `SOLUTION_ENCRYPTION_KEY` is configured. Format: `"enc:" + base64(nonce + ciphertext + authTag)`.

### Solver Proxy
External service at `SOLVER_URL` (default: `http://localhost:5000`). Endpoints: `/api/solve`, `/api/validate`, `/api/generate`. Configurable timeout via `SOLVER_TIMEOUT_MS` (default: 60s). Uses AbortController.

### Gamification Points
- Base points: `2^level` (exponential scaling)
- Multipliers: +10x for no hints, +2x for no interruption
- Hint tracking: `2 × techniqueLevel` (immediate on hint use)

## Environment Variables

Bun loads `.env` automatically. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Server port (default: 3000) |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK |
| `SITEADMIN_EMAILS` | Comma-separated admin emails |
| `ADMIN_EMAILS` | Additional admin emails |
| `REVENUECAT_API_KEY` | RevenueCat subscription service |
| `SOLVER_URL` | External solver service URL |
| `SOLVER_TIMEOUT_MS` | Solver request timeout |
| `SOLUTION_ENCRYPTION_KEY` | AES-256-GCM hex key (64 chars, optional) |
| `APPLE_*` | Apple Sign-In configuration |

## @sudobility Dependencies

| Package | Purpose |
|---------|---------|
| `@sudobility/auth_service` | Firebase auth wrapper, token caching |
| `@sudobility/subscription_service` | RevenueCat integration |
| `@sudobility/sudojo_ocr` | OCR logic for image extraction |
| `@sudobility/sudojo_types` | Shared type definitions, response shapes |
| `@sudobility/types` | General shared types |

## Code Conventions

- Use Zod for all request validation
- Return consistent response shapes using `successResponse()` / `errorResponse()`
- Keep route handlers thin; put logic in services
- Route files export default Hono router instance
- Async/await, not callbacks
- TypeScript strict mode enabled
- Prettier: double quotes, 80 char width, 2 spaces, trailing commas (es5)
- ESLint: unused vars with `^_` prefix exemption, prefer-const, no-var

## Testing

- **Unit tests**: Vitest in `tests/unit/`
- **Integration tests**: bun:test in `tests/`, require `.env.test` with `sudojo_test` database
- Safety check: tests refuse to run against production database
- Firebase/RevenueCat are mocked in test setup
- Database cleaned between tests

## Docker

Multi-stage build: type-checks before building, production stage installs only prod dependencies. Exposes port 8010.

## Database

Tables created idempotently via `bun run db:init`. Migrations use `ALTER TABLE ADD COLUMN IF NOT EXISTS` (forward-only). Table creation respects foreign key dependencies. Graceful shutdown closes database connection.

**Core tables**: levels, techniques, learning, boards, dailies, challenges, technique_practices, technique_examples
**Gamification tables**: user_stats, badge_definitions, user_badges, game_sessions, point_transactions

## Common Tasks

### Add New Endpoint
1. Create route file in `src/routes/` or add to existing
2. Define Zod schemas in `src/schemas/`
3. Add business logic in `src/services/` if complex
4. Register route in `src/routes/index.ts`
5. Add tests

### Add Database Table
1. Define schema in `src/db/schema.ts`
2. Add creation logic in `src/db/init.ts`
3. Run `bun run db:init` to apply
4. Create corresponding types in `@sudobility/sudojo_types` if shared

### Debug
```bash
bun run dev                        # Hot-reload dev server
bun run --inspect src/index.ts     # Start with debugger
```
