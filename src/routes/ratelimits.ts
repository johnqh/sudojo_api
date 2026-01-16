import { Hono } from "hono";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";
import {
  RateLimitPeriodType,
  type RateLimitsConfigResponse,
  type RateLimitHistoryResponse,
} from "@sudobility/types";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { getRateLimitRouteHandler, getTestMode } from "../middleware/rateLimit";

const ratelimitsRouter = new Hono();

/**
 * GET /ratelimits
 * Returns rate limit configurations for all entitlement tiers
 * and the current user's usage.
 * Supports ?testMode=true query param for sandbox mode.
 */
ratelimitsRouter.get("/", firebaseAuthMiddleware, async c => {
  try {
    const firebaseUser = c.get("firebaseUser");
    const testMode = getTestMode(c);
    const data = await getRateLimitRouteHandler().getRateLimitsConfigData(
      firebaseUser.uid,
      testMode
    );

    return c.json(successResponse(data) as RateLimitsConfigResponse);
  } catch (error) {
    console.error("Error fetching rate limits config:", error);
    return c.json(errorResponse("Failed to fetch rate limits"), 500);
  }
});

/**
 * GET /ratelimits/history/:periodType
 * Returns usage history for a specific period type.
 * periodType can be: hour, day, or month
 * Supports ?testMode=true query param for sandbox mode.
 */
ratelimitsRouter.get(
  "/history/:periodType",
  firebaseAuthMiddleware,
  async c => {
    try {
      const periodTypeParam = c.req.param("periodType");

      // Validate period type
      if (!["hour", "day", "month"].includes(periodTypeParam)) {
        return c.json(
          errorResponse(
            "Invalid period type. Must be one of: hour, day, month"
          ),
          400
        );
      }

      const periodType = periodTypeParam as RateLimitPeriodType;
      const firebaseUser = c.get("firebaseUser");
      const testMode = getTestMode(c);

      const data = await getRateLimitRouteHandler().getRateLimitHistoryData(
        firebaseUser.uid,
        periodType,
        undefined, // use default limit
        testMode
      );

      return c.json(successResponse(data) as RateLimitHistoryResponse);
    } catch (error) {
      console.error("Error fetching rate limit history:", error);
      return c.json(errorResponse("Failed to fetch rate limit history"), 500);
    }
  }
);

export default ratelimitsRouter;
