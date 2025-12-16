import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import { userIdParamSchema } from "../schemas";
import { getSubscriberEntitlements } from "../services/revenuecat";
import { successResponse, errorResponse } from "@sudobility/sudojo_types";

const usersRouter = new Hono();

// GET user subscriptions (requires Firebase auth)
usersRouter.get(
  "/:userId/subscriptions",
  firebaseAuthMiddleware,
  zValidator("param", userIdParamSchema),
  async c => {
    const { userId } = c.req.valid("param");
    const firebaseUser = c.get("firebaseUser");

    // Ensure the authenticated user can only access their own subscription
    if (firebaseUser.uid !== userId) {
      return c.json(
        errorResponse("You can only access your own subscription"),
        403
      );
    }

    try {
      const subscriptionResult = await getSubscriberEntitlements(userId);
      return c.json(successResponse(subscriptionResult));
    } catch (error) {
      console.error("Error fetching subscription:", error);
      return c.json(errorResponse("Failed to fetch subscription status"), 500);
    }
  }
);

export default usersRouter;
