import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getRequiredEnv, getEnv } from "../lib/env-helper";

// Token verification cache to reduce Firebase API calls
// Firebase ID tokens are valid for 1 hour; we cache for a shorter period (default 5 min)
const TOKEN_CACHE_TTL_MS = parseInt(getEnv("FIREBASE_TOKEN_CACHE_TTL_MS") || "300000", 10);

interface CachedToken {
  decodedToken: DecodedIdToken;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedToken>();

// Cleanup expired tokens periodically (every minute)
const CLEANUP_INTERVAL_MS = 60000;
setInterval(() => {
  const now = Date.now();
  for (const [token, cached] of tokenCache) {
    if (cached.expiresAt <= now) {
      tokenCache.delete(token);
    }
  }
}, CLEANUP_INTERVAL_MS);

const FIREBASE_PROJECT_ID = getRequiredEnv("FIREBASE_PROJECT_ID");
const FIREBASE_CLIENT_EMAIL = getRequiredEnv("FIREBASE_CLIENT_EMAIL");
const FIREBASE_PRIVATE_KEY = getRequiredEnv("FIREBASE_PRIVATE_KEY").replace(
  /\\n/g,
  "\n"
);

let app: App;

if (getApps().length === 0) {
  app = initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
} else {
  app = getApps()[0]!;
}

const auth = getAuth(app);

export async function verifyIdToken(token: string, ttlMs?: number): Promise<DecodedIdToken> {
  const now = Date.now();
  const cacheTtl = ttlMs ?? TOKEN_CACHE_TTL_MS;

  // Check cache first
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) {
    return cached.decodedToken;
  }

  // Verify with Firebase and cache the result
  const decodedToken = await auth.verifyIdToken(token);

  // Cache the decoded token with specified TTL
  tokenCache.set(token, {
    decodedToken,
    expiresAt: now + cacheTtl,
  });

  return decodedToken;
}

export function isAnonymousUser(decodedToken: DecodedIdToken): boolean {
  return decodedToken.firebase?.sign_in_provider === "anonymous";
}

/**
 * Extend the cache TTL for a token (e.g., after confirming user is an admin)
 */
export function extendTokenCacheTTL(token: string, ttlMs: number): void {
  const cached = tokenCache.get(token);
  if (cached) {
    cached.expiresAt = Date.now() + ttlMs;
  }
}
