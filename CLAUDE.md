# CLAUDE.md

This file provides context for AI assistants working on this codebase.

## Project Overview

`sudojo_api` is the backend API server for Sudojo, a Sudoku learning platform. Built with Hono framework running on Bun runtime, it provides REST endpoints for:
- Daily puzzles and challenges
- Puzzle levels and difficulty progression
- Sudoku solving techniques
- User learning progress tracking
- Authentication via Firebase

## Runtime & Package Manager

**This project uses Bun exclusively.** Do not use npm, yarn, or pnpm.

```bash
bun install          # Install dependencies
bun run dev          # Start dev server with hot reload
bun run start        # Start production server
bun run build        # Bundle for production
bun run build:compile # Create standalone executable
bun test             # Run tests
bun run typecheck    # Type-check without emitting
bun run lint         # Run ESLint
bun run format       # Format with Prettier
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: Hono (fast, lightweight web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod schemas with @hono/zod-validator
- **Auth**: Firebase Admin SDK
- **Types**: @sudobility/sudojo_types, @sudobility/types

## Project Structure

```
src/
├── index.ts           # App entry point, Hono app setup
├── routes/            # API route handlers
│   ├── dailies.ts     # Daily puzzle endpoints
│   ├── levels.ts      # Puzzle level endpoints
│   ├── boards.ts      # Board/puzzle endpoints
│   ├── techniques.ts  # Solving technique endpoints
│   ├── challenges.ts  # Challenge endpoints
│   └── learning.ts    # Learning progress endpoints
├── db/                # Database layer
│   ├── schema.ts      # Drizzle schema definitions
│   └── init.ts        # Database initialization
├── middleware/        # Hono middleware
│   └── auth.ts        # Firebase auth middleware
├── services/          # Business logic services
├── schemas/           # Zod validation schemas
└── lib/               # Utility functions
tests/                 # Test files (bun:test)
```

## API Patterns

### Route Definition
```typescript
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

const app = new Hono();

app.get('/items/:id', zValidator('param', z.object({ id: z.string() })), async (c) => {
  const { id } = c.req.valid('param');
  // ... handle request
  return c.json({ data });
});
```

### Authentication
Routes requiring auth use Firebase middleware:
```typescript
import { authMiddleware } from '../middleware/auth';

app.use('/protected/*', authMiddleware);
```

### Database Queries
Using Drizzle ORM:
```typescript
import { db } from '../db';
import { puzzles } from '../db/schema';
import { eq } from 'drizzle-orm';

const puzzle = await db.select().from(puzzles).where(eq(puzzles.id, id));
```

## Testing

Tests use Bun's native test runner:

```typescript
import { test, expect, describe } from 'bun:test';

describe('Levels API', () => {
  test('should return levels list', async () => {
    const response = await app.request('/api/levels');
    expect(response.status).toBe(200);
  });
});
```

Run tests:
```bash
bun test                    # All tests
bun run test:unit           # Unit tests only
bun test tests/levels       # Specific test file
```

## Environment Variables

Bun automatically loads `.env` files. Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `FIREBASE_*` - Firebase Admin SDK credentials

## Code Conventions

- Use Zod for all request validation
- Return consistent response shapes using @sudobility/types
- Keep route handlers thin; put logic in services
- Use async/await, not callbacks
- TypeScript strict mode enabled

## Common Tasks

### Add New Endpoint
1. Create route file in `src/routes/` or add to existing
2. Define Zod schemas in `src/schemas/`
3. Add business logic in `src/services/` if complex
4. Register route in `src/index.ts`
5. Add tests in `tests/`

### Add Database Table
1. Define schema in `src/db/schema.ts`
2. Run `bun run db:init` to apply changes
3. Create corresponding types if needed

### Debug
```bash
bun run --inspect src/index.ts  # Start with debugger
```
