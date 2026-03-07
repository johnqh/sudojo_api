# sudojo_api

Backend API server for Sudojo, a Sudoku learning platform. Built with Hono on Bun.

## Setup

```bash
bun install
# Configure .env with DATABASE_URL, Firebase credentials
bun run db:init      # Initialize database tables
bun run dev          # Start dev server (port 3000)
```

## Routes

| Prefix | Purpose |
|--------|---------|
| `/api/v1/dailies` | Daily puzzle endpoints |
| `/api/v1/levels` | Puzzle level endpoints |
| `/api/v1/boards` | Board/puzzle endpoints |
| `/api/v1/techniques` | Solving technique endpoints |
| `/api/v1/challenges` | Challenge endpoints |
| `/api/v1/learning` | Learning progress endpoints |

Firebase authentication required for protected routes.

## Development

```bash
bun run dev          # Dev server with hot reload
bun test             # Run tests
bun run typecheck    # TypeScript check
bun run lint         # ESLint
bun run format       # Prettier
```

## Related Packages

- `@sudobility/sudojo_types` -- Shared type definitions
- `sudojo_app` / `sudojo_app_rn` -- Frontend apps
- `sudojo_solver` -- Sudoku solving engine API

## License

BUSL-1.1
