import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initDatabase, initGamificationTables } from "./db";
import routes from "./routes";
import { successResponse } from "@sudobility/sudojo_types";
import { getEnv } from "./lib/env-helper";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check endpoints
const healthResponse = {
  name: "Sudojo API",
  version: "1.0.0",
  status: "healthy",
};

app.get("/", c => c.json(successResponse(healthResponse)));
app.get("/health", c => c.json(successResponse(healthResponse)));

// API routes
app.route("/api/v1", routes);

// Initialize database and start server
const port = parseInt(getEnv("PORT", "3000")!);

initDatabase()
  .then(() => initGamificationTables())
  .then(() => {
    console.log(`Server running on http://localhost:${port}`);
  })
  .catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

export default {
  port,
  fetch: app.fetch,
  // Increase idle timeout for long-running requests like /validate (default is 10s)
  idleTimeout: 120, // 2 minutes
};

// Export app for testing
export { app };
