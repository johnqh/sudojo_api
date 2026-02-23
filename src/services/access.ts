/**
 * @fileoverview Access control service for content-gating
 *
 * Manages daily access limits for non-subscriber users.
 * Each endpoint has a configurable daily limit. When the limit is reached,
 * access is denied and the user is prompted to subscribe.
 *
 * This is separate from rate limiting (which prevents API abuse).
 * Subscribers bypass this system entirely via the access control middleware.
 */

import { eq, and, count } from "drizzle-orm";
import { db, accessLogs } from "../db";

/** Daily access limits per endpoint for non-subscriber users */
const DAILY_LIMITS: Record<string, number> = {
  boards: 2,
  dailies: 2,
  challenges: 2,
  solve: 10,
};

/** Default daily limit for endpoints not explicitly configured */
const DEFAULT_DAILY_LIMIT = 2;

/**
 * Get the daily access limit for a given endpoint.
 * @param endpoint - The endpoint identifier (e.g., "boards", "solve")
 * @returns The maximum number of daily accesses allowed
 */
function getDailyLimit(endpoint: string): number {
  return DAILY_LIMITS[endpoint] ?? DEFAULT_DAILY_LIMIT;
}

/**
 * Get today's date as a YYYY-MM-DD string.
 */
function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

/**
 * Count how many times a user has accessed an endpoint today.
 * @param userId - Firebase user ID
 * @param endpoint - The endpoint identifier
 * @returns The number of accesses recorded today
 */
export async function getAccessCountToday(
  userId: string,
  endpoint: string
): Promise<number> {
  const today = getTodayDate();
  const result = await db
    .select({ count: count() })
    .from(accessLogs)
    .where(
      and(
        eq(accessLogs.user_id, userId),
        eq(accessLogs.endpoint, endpoint),
        eq(accessLogs.access_date, today)
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Record an access log entry for a user on an endpoint.
 * @param userId - Firebase user ID
 * @param endpoint - The endpoint identifier
 */
export async function recordAccess(
  userId: string,
  endpoint: string
): Promise<void> {
  const today = getTodayDate();
  await db.insert(accessLogs).values({
    user_id: userId,
    endpoint,
    access_date: today,
  });
}

/**
 * Check if a user can access an endpoint and record the access if granted.
 *
 * @param userId - Firebase user ID
 * @param endpoint - The endpoint identifier
 * @returns Object with `granted` (whether access was allowed) and `remaining`
 *          (number of accesses left today, 0 if denied)
 */
export async function checkAndRecordAccess(
  userId: string,
  endpoint: string
): Promise<{ granted: boolean; remaining: number }> {
  const limit = getDailyLimit(endpoint);
  const accessCount = await getAccessCountToday(userId, endpoint);
  if (accessCount >= limit) {
    return { granted: false, remaining: 0 };
  }
  await recordAccess(userId, endpoint);
  return { granted: true, remaining: limit - accessCount - 1 };
}
