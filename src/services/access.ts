import { eq, and, count } from "drizzle-orm";
import { db, accessLogs } from "../db";

const DAILY_LIMITS: Record<string, number> = {
  boards: 2,
  dailies: 2,
  challenges: 2,
  solve: 10,
};

const DEFAULT_DAILY_LIMIT = 2;

function getDailyLimit(endpoint: string): number {
  return DAILY_LIMITS[endpoint] ?? DEFAULT_DAILY_LIMIT;
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

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
