import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.db.ts"],
    include: ["**/*.db.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // One database, shared across files. Parallel files corrupt each other.
    fileParallelism: false,
    // @sudobility service packages are compiled by tsc with extensionless and
    // directory-style relative imports. Bun resolves them; Node's ESM resolver,
    // which vitest uses for bare dependencies, does not.
    server: {
      deps: {
        inline: ["@sudobility/auth_service", "@sudobility/subscription_service"],
      },
    },
  },
});
