# Improvement Plans for @sudobility/sudojo_api

## Priority 1 - High Impact

### 1. Add JSDoc to Route Handlers and Service Functions -- DONE
- ✅ All 14 route modules (`levels.ts`, `techniques.ts`, `learning.ts`, `boards.ts`, `dailies.ts`, `challenges.ts`, `users.ts`, `solver.ts`, `ratelimits.ts`, `examples.ts`, `practices.ts`, `play.ts`, `gamification.ts`, `ocr.ts`) now have JSDoc on every route handler documenting: HTTP method, URL path, request/response shapes, authentication requirements, and error responses.
- ✅ The routes index (`src/routes/index.ts`) now has a @fileoverview documenting all route modules and their auth requirements.
- ✅ Service functions in `src/services/` (`access.ts`, `firebase.ts`) now document their behavior, error conditions, and side effects.
- ✅ Middleware functions (`auth.ts`, `firebaseAuth.ts`, `accessControl.ts`, `hintAccess.ts`, `rateLimit.ts`) already had JSDoc or now have enhanced documentation for context variables, errors, and ordering requirements.
- ✅ The database initialization functions (`initDatabase`, `initGamificationTables`) now document the schema versioning strategy (forward-only, idempotent CREATE/ALTER IF NOT EXISTS), table creation order for foreign key dependencies, and error conditions.

### 2. Improve Database Schema Management -- PARTIALLY DONE
- ✅ Database initialization in `src/db/index.ts` now has comprehensive JSDoc documenting the schema versioning strategy: forward-only migrations using idempotent SQL (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS), explicit table creation order for foreign key dependencies, and the lack of rollback mechanism.
- The Drizzle ORM is listed as a dependency and `src/db/schema.ts` exists alongside the raw SQL initialization. This dual approach (Drizzle schema + raw SQL init) can lead to schema drift. Consider using Drizzle Kit migrations exclusively.
- No rollback mechanism exists for failed migrations. If `initGamificationTables` fails partway through, the database could be left in an inconsistent state.
- ✅ Table creation order is now explicitly documented in the JSDoc for `initDatabase()` and `initGamificationTables()`.

### 3. Expand Integration Test Coverage -- PARTIALLY DONE
- Test files exist for core routes: `levels.test.ts`, `techniques.test.ts`, `learning.test.ts`, `boards.test.ts`, `dailies.test.ts`, `challenges.test.ts`, `solver.test.ts`, `solver-techniques.test.ts`, and `auth.test.ts`.
- ✅ Expanded unit test coverage: `schemas.test.ts` now covers all 15+ schema modules (90 tests, up from ~30). Added `env-helper.test.ts` (8 tests) for the environment variable utility.
- Missing integration test coverage for: `users.ts`, `ratelimits.ts`, `examples.ts`, `practices.ts`, `play.ts`, `gamification.ts`, and `ocr.ts` routes. (Requires database setup and external service mocking -- skipped as complex infrastructure.)
- The gamification flow (start game -> use hints -> finish game -> earn points/badges) is complex and has no integration tests.
- Rate limiting middleware (`rateLimit.ts`) has sophisticated logic for subscription-based tiers but no dedicated tests.
- The `hintAccess.ts` middleware enforces hint level limits based on entitlements but has no tests verifying the access control logic.

## Priority 2 - Medium Impact

### 4. Add Request Validation Consistency
- The CLAUDE.md mentions Zod for validation and `src/schemas/` exists for Zod schemas, but it is unclear whether all 14 route modules use Zod validation consistently.
- The `adminMiddleware` in `auth.ts` manually parses the Authorization header. Consider using a shared auth parsing utility or Zod schema for consistency.
- Query parameter parsing appears to happen manually in route handlers. Centralizing this with Zod validators would catch invalid parameters earlier and provide better error messages.
- The rate limit middleware casts to `any` in multiple places (`db as any`, `c as any`) to work around type conflicts. This reduces type safety in a critical security path.

### 5. Improve Error Response Consistency -- PARTIALLY DONE
- The API uses `errorResponse()` from `@sudobility/sudojo_types` for errors, but error message formats may vary across route handlers (some may use raw strings, others structured error objects).
- ✅ HTTP status codes are now documented per endpoint via JSDoc on every route handler.
- The `HintAccessDeniedResponse` type (402) is a special error shape. Document all non-standard error response shapes that the API can return.
- ✅ Added a global error handler (`app.onError`) to catch unhandled exceptions and return consistent 500 responses with `errorResponse()`.
- ✅ Added a 404 handler (`app.notFound`) for routes that don't match any registered handlers.

### 6. Add Health Check Depth and Monitoring
- The current health check (`/` and `/health`) returns a static response without verifying database connectivity. A deeper health check that pings the database would catch connection issues.
- No structured logging is in place beyond Hono's built-in logger middleware. Adding request IDs, user IDs, and structured error logging would improve debugging in production.
- The server's `idleTimeout` is set to 120 seconds for long-running requests like `/validate`, but there is no request-level timeout to prevent individual requests from hanging indefinitely.

## Priority 3 - Nice to Have

### 7. Add OpenAPI/Swagger Documentation
- With 14 route modules and 30+ endpoints, the API would benefit from auto-generated OpenAPI documentation.
- Hono has OpenAPI middleware (`@hono/swagger-ui`, `@hono/zod-openapi`) that could generate documentation from the existing Zod schemas.
- This would also serve as a contract between the API and the client library, helping to detect breaking changes.

### 8. Improve Rate Limiting Architecture
- The rate limit middleware uses lazy initialization with singleton instances. This pattern makes testing difficult and prevents per-request configuration.
- The `any` casts throughout `rateLimit.ts` (6+ instances) indicate a type compatibility issue between different package versions of Drizzle ORM and Hono. Resolving this would improve maintainability.
- Rate limit configuration (`rateLimitsConfig`) is hardcoded. Consider making it configurable via environment variables for different deployment environments.

### 9. Add Database Connection Pooling and Graceful Shutdown -- PARTIALLY DONE
- The database connection uses a single `postgres` client. For production workloads, connection pooling configuration should be explicit (max connections, idle timeout, etc.).
- ✅ Added graceful shutdown handlers for SIGTERM and SIGINT that call `closeDatabase()` to properly close the PostgreSQL connection before exiting.
- The server initialization chain (`initDatabase().then(() => initGamificationTables())`) logs success but the server starts accepting requests before database initialization completes (since `export default` runs synchronously). This could cause early requests to fail.

## Additional Improvements Made

### 10. Added `verify` Script
- ✅ Added `bun run verify` script to `package.json` that runs `typecheck`, `lint`, and `test` in sequence. This follows the ecosystem convention for pre-commit verification.
