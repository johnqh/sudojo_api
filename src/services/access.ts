import { eq, and } from "drizzle-orm";
import { db, accessLogs } from "../db";

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function hasAccessedToday(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const today = getTodayDate();
  const rows = await db
    .select()
    .from(accessLogs)
    .where(
      and(
        eq(accessLogs.user_id, userId),
        eq(accessLogs.endpoint, endpoint),
        eq(accessLogs.access_date, today)
      )
    );
  return rows.length > 0;
}

export async function recordAccess(
  userId: string,
  endpoint: string
): Promise<void> {
  const today = getTodayDate();
  await db
    .insert(accessLogs)
    .values({
      user_id: userId,
      endpoint,
      access_date: today,
    })
    .onConflictDoNothing();
}

export async function checkAndRecordAccess(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const alreadyAccessed = await hasAccessedToday(userId, endpoint);
  if (alreadyAccessed) {
    return false;
  }
  await recordAccess(userId, endpoint);
  return true;
}
