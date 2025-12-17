import { getRequiredEnv } from "../lib/env-helper";
import type {
  RevenueCatEntitlement,
  SubscriptionResult,
} from "@sudobility/sudojo_types";

const REVENUECAT_API_KEY = getRequiredEnv("REVENUECAT_API_KEY");

const REVENUECAT_BASE_URL = "https://api.revenuecat.com/v1";

interface RevenueCatSubscriberResponse {
  subscriber: {
    entitlements: {
      [key: string]: RevenueCatEntitlement;
    };
  };
}

export async function getSubscriberEntitlements(
  userId: string
): Promise<SubscriptionResult> {
  const response = await fetch(
    `${REVENUECAT_BASE_URL}/subscribers/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${REVENUECAT_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (response.status === 404) {
    return {
      hasSubscription: false,
      entitlement: null,
    };
  }

  if (!response.ok) {
    throw new Error(
      `RevenueCat API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as RevenueCatSubscriberResponse;
  const sudojoEntitlement = data.subscriber?.entitlements?.["sudojo"];

  if (!sudojoEntitlement) {
    return {
      hasSubscription: false,
      entitlement: null,
    };
  }

  const isActive =
    !sudojoEntitlement.expires_date ||
    new Date(sudojoEntitlement.expires_date) > new Date();

  return {
    hasSubscription: isActive,
    entitlement: sudojoEntitlement,
  };
}
