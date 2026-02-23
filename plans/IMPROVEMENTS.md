# Improvement Plans for @sudobility/sudojo_api

## Priority 1 - High Impact

### 1. Add JSDoc to Route Handlers and Service Functions
- The API has 14 route modules (`levels.ts`, `techniques.ts`, `learning.ts`, `boards.ts`, `dailies.ts`, `challenges.ts`, `users.ts`, `solver.ts`, `ratelimits.ts`, `examples.ts`, `practices.ts`, `play.ts`, `gamification.ts`, `ocr.ts`) but route handlers lack JSDoc documenting: HTTP method, URL path, request/response shapes, authentication requirements, and error responses.
- Service functions in `src/services/` (`access.ts`, `firebase.ts`) should document their behavior, error conditions, and side effects.
- Middleware functions (`auth.ts`, `firebaseAuth.ts`, `accessControl.ts`, `hintAccess.ts`, `rateLimit.ts`) should document what context variables they set, what errors they return, and their ordering requirements.
- The database initialization functions (`initDatabase`, `initGamificationTables`) contain raw SQL for table creation and migration but lack documentation on the schema versioning strategy.

### 2. Improve Database Schema Management
- Database initialization uses raw SQL strings in `src/db/index.ts` with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` for migrations. This approach does not track migration history, making it difficult to know which migrations have been applied.
- The Drizzle ORM is listed as a dependency and `src/db/schema.ts` exists alongside the raw SQL initialization. This dual approach (Drizzle schema + raw SQL init) can lead to schema drift. Consider using Drizzle Kit migrations exclusively.
- No rollback mechanism exists for failed migrations. If `initGamificationTables` fails partway through, the database could be left in an inconsistent state.
- Table creation order matters due to foreign key constraints (e.g., `techniques` references `levels`), but this ordering is implicit and could break if tables are added.

### 3. Expand Integration Test Coverage
- Test files exist for core routes: `levels.test.ts`, `techniques.test.ts`, `learning.test.ts`, `boards.test.ts`, `dailies.test.ts`, `challenges.test.ts`, `solver.test.ts`, `solver-techniques.test.ts`, and `auth.test.ts`.
- Missing test coverage for: `users.ts`, `ratelimits.ts`, `examples.ts`, `practices.ts`, `play.ts`, `gamification.ts`, and `ocr.ts` routes.
- The gamification flow (start game -> use hints -> finish game -> earn points/badges) is complex and has no integration tests.
- Rate limiting middleware (`rateLimit.ts`) has sophisticated logic for subscription-based tiers but no dedicated tests.
- The `hintAccess.ts` middleware enforces hint level limits based on entitlements but has no tests verifying the access control logic.

## Priority 2 - Medium Impact

### 4. Add Request Validation Consistency
- The CLAUDE.md mentions Zod for validation and `src/schemas/` exists for Zod schemas, but it is unclear whether all 14 route modules use Zod validation consistently.
- The `adminMiddleware` in `auth.ts` manually parses the Authorization header. Consider using a shared auth parsing utility or Zod schema for consistency.
- Query parameter parsing appears to happen manually in route handlers. Centralizing this with Zod validators would catch invalid parameters earlier and provide better error messages.
- The rate limit middleware casts to `any` in multiple places (`db as any`, `c as any`) to work around type conflicts. This reduces type safety in a critical security path.

### 5. Improve Error Response Consistency
- The API uses `errorResponse()` from `@sudobility/sudojo_types` for errors, but error message formats may vary across route handlers (some may use raw strings, others structured error objects).
- HTTP status codes should be documented per endpoint. Currently, the middleware returns 401/403 but route handler status codes are not visible from the code examined.
- The `HintAccessDeniedResponse` type (402) is a special error shape. Document all non-standard error response shapes that the API can return.
- Consider adding a global error handler middleware to catch unhandled exceptions and return consistent 500 responses.

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

### 9. Add Database Connection Pooling and Graceful Shutdown
- The database connection uses a single `postgres` client. For production workloads, connection pooling configuration should be explicit (max connections, idle timeout, etc.).
- The `closeDatabase()` function exists but there is no graceful shutdown handler that calls it when the server process receives SIGTERM/SIGINT.
- The server initialization chain (`initDatabase().then(() => initGamificationTables())`) logs success but the server starts accepting requests before database initialization completes (since `export default` runs synchronously). This could cause early requests to fail.
