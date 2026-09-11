/**
 * GET /solver/solve is unrestricted: hint limits are deliberately NOT enforced
 * (the route-level check was removed in 4e8de9b and the owner decided to keep
 * it that way). Anonymous and free (no-entitlement) users get every hint
 * level, including level 12, exactly as the solver returned it.
 *
 * This also pins the parts of the optional-auth middleware that routes do rely
 * on: a bad Bearer token is a 401 AUTH_TOKEN_INVALID (clients refresh and
 * retry), a good one identifies the user for hint-point tracking, and a
 * request carrying the configured ADMIN_API_KEY skips token verification.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakePostgres as pg } from "./fake-postgres";

vi.hoisted(() => {
  // solver-proxy reads SOLVER_URL at import time. fetch is stubbed below.
  process.env.SOLVER_URL = "http://solver.invalid";
});

vi.mock("../../src/db", async importOriginal => {
  const actual = await importOriginal<typeof import("../../src/db")>();
  const { fakePostgres } = await import("./fake-postgres");
  return { ...actual, db: fakePostgres.db };
});

// Firebase: one valid free-user token; anything else is rejected.
vi.mock("../../src/services/firebase", () => ({
  verifyIdToken: vi.fn(async (token: string) => {
    if (token === "free-user-token") {
      return { uid: "free-1", email: "free@example.com" };
    }
    throw new Error("Firebase ID token has expired");
  }),
  isSiteAdmin: () => false,
  isAnonymousUser: () => false,
}));

// RevenueCat: a free user with no entitlements. Never reaches the network.
const getSubscriptionInfo = vi.hoisted(() =>
  vi.fn(async () => ({ entitlements: [] as string[] }))
);
vi.mock("../../src/middleware/subscription", () => ({
  getSubscriptionHelper: () => ({ getSubscriptionInfo }),
  getTestMode: () => false,
}));

const { default: solverRouter } = await import("../../src/routes/solver");

const PUZZLE = "0".repeat(81);

/** A level-12 hint: above every tier limit the old gate knew about. */
const solverSolve = {
  success: true,
  error: null,
  data: {
    board: {
      original: PUZZLE,
      user: PUZZLE,
      pencilmark: { autopencil: false, numbers: "" },
    },
    hints: {
      technique: 36,
      level: 12,
      title: "Forcing Chains",
      text: "",
      steps: [
        {
          title: "Forcing Chains",
          text: "Either way, r1c1 is 5",
          areas: [],
          cells: [],
          localization: { stringKey: "hint.forcing", values: ["5"] },
        },
      ],
    },
  },
};

function stubSolver() {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(solverSolve), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function solve(headers: Record<string, string> = {}) {
  const res = await solverRouter.request(`/solve?original=${PUZZLE}`, {
    headers,
  });
  return { status: res.status, body: (await res.json()) as any };
}

beforeEach(() => {
  pg.reset();
  pg.seed("techniques", [{ technique: 36, path: "forcing-chains" }]);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /solver/solve stays unrestricted", () => {
  it("gives an anonymous caller a level-12 hint in full", async () => {
    const fetchMock = stubSolver();
    const { status, body } = await solve();

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.hints.level).toBe(12);
    expect(body.data.hints.technique).toBe(36);
    expect(body.data.hints.steps).toHaveLength(1);
    expect(body.data.hints.steps[0].text).toBe("Either way, r1c1 is 5");
    expect(body.data.board).toEqual(solverSolve.data.board);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives a free signed-in user the same level-12 hint", async () => {
    stubSolver();
    const anonymous = await solve();
    stubSolver();
    const free = await solve({ Authorization: "Bearer free-user-token" });

    expect(free.status).toBe(200);
    expect(free.body.success).toBe(true);
    expect(free.body.data).toEqual(anonymous.body.data);
  });

  it("exposes no limit fields and never answers 402", async () => {
    const callers: Record<string, string>[] = [
      {},
      { Authorization: "Bearer free-user-token" },
    ];
    for (const headers of callers) {
      stubSolver();
      const { status, body } = await solve(headers);
      expect(status).not.toBe(402);
      const text = JSON.stringify(body);
      for (const field of [
        "hintAccess",
        "maxHintLevel",
        "userState",
        "requiredEntitlement",
        "HINT_ACCESS_DENIED",
      ]) {
        expect(text).not.toContain(field);
      }
    }
  });

  it("answers a bad Bearer token with 401 AUTH_TOKEN_INVALID", async () => {
    const fetchMock = stubSolver();
    const { status, body } = await solve({ Authorization: "Bearer expired" });

    expect(status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: "Invalid or expired token",
      code: "AUTH_TOKEN_INVALID",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips token verification for the configured ADMIN_API_KEY", async () => {
    vi.stubEnv("ADMIN_API_KEY", "script-key");
    stubSolver();
    const { status, body } = await solve({
      "X-API-Key": "script-key",
      Authorization: "Bearer expired",
    });

    expect(status).toBe(200);
    expect(body.data.hints.level).toBe(12);
  });
});
