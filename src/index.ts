import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initDatabase } from "./db";
import routes from "./routes";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/", (c) => {
  return c.json({
    name: "Sudojo API",
    version: "1.0.0",
    status: "healthy",
  });
});

// API routes
app.route("/api/v1", routes);

// Initialize database and start server
const port = parseInt(process.env.PORT || "3000");

initDatabase()
  .then(() => {
    console.log(`Server running on http://localhost:${port}`);
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });

export default {
  port,
  fetch: app.fetch,
};

// Export app for testing
export { app };
