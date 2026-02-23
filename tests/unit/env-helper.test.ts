import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getEnv, getRequiredEnv } from "../../src/lib/env-helper";

describe("env-helper", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
  });

  describe("getEnv", () => {
    it("should return process.env value when set", () => {
      process.env.TEST_VAR_123 = "from-process";
      expect(getEnv("TEST_VAR_123")).toBe("from-process");
    });

    it("should return defaultValue when env var is not set", () => {
      delete process.env.NONEXISTENT_VAR_XYZ;
      expect(getEnv("NONEXISTENT_VAR_XYZ", "default-val")).toBe("default-val");
    });

    it("should return undefined when env var is not set and no default", () => {
      delete process.env.NONEXISTENT_VAR_ABC;
      expect(getEnv("NONEXISTENT_VAR_ABC")).toBeUndefined();
    });

    it("should prefer process.env over default value", () => {
      process.env.TEST_PRIORITY = "env-value";
      expect(getEnv("TEST_PRIORITY", "default")).toBe("env-value");
    });

    it("should skip empty string process.env values", () => {
      process.env.EMPTY_VAR = "";
      expect(getEnv("EMPTY_VAR", "fallback")).toBe("fallback");
    });
  });

  describe("getRequiredEnv", () => {
    it("should return value when env var is set", () => {
      process.env.REQUIRED_VAR = "required-value";
      expect(getRequiredEnv("REQUIRED_VAR")).toBe("required-value");
    });

    it("should throw when env var is not set", () => {
      delete process.env.MISSING_REQUIRED;
      expect(() => getRequiredEnv("MISSING_REQUIRED")).toThrow(
        "Required environment variable MISSING_REQUIRED is not set"
      );
    });

    it("should throw when env var is empty string", () => {
      process.env.EMPTY_REQUIRED = "";
      expect(() => getRequiredEnv("EMPTY_REQUIRED")).toThrow(
        "Required environment variable EMPTY_REQUIRED is not set"
      );
    });
  });
});
