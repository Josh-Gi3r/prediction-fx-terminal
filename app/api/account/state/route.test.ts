/**
 * Tests for GET /api/account/state
 *
 * Covers:
 *   (a) 401 without session
 *   (b) session for wallet A cannot read wallet B's rows
 *       (mock readSession to return A, assert only A's data is queried)
 *   (c) returns { prefs, vlBatches } on success
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock readSession before importing the route.
vi.mock("@/lib/account/session", () => ({
  readSession: vi.fn(),
}));

// Mock sql before importing the route.
vi.mock("@/lib/db/client", () => ({
  sql: vi.fn(),
}));

import { readSession } from "@/lib/account/session";
import { sql } from "@/lib/db/client";
import { GET } from "./route";

const mockReadSession = vi.mocked(readSession);
const mockSql = vi.mocked(sql);

function makeReq(url = "http://localhost/api/account/state"): NextRequest {
  return new NextRequest(url);
}

// Helper: make sql behave as a tagged-template that returns the given rows.
function mockSqlReturns(stateRows: unknown[], batchRows: unknown[]) {
  let callCount = 0;
  // sql is used as a tagged template: sql`...` returns a Promise<row[]>.
  // We mock it as a function returning Promises in call order.
  (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    if (callCount === 1) return Promise.resolve(stateRows);
    return Promise.resolve(batchRows);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_JWT_SECRET = "a".repeat(64);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/account/state", () => {
  it("returns 401 when readSession returns null", async () => {
    mockReadSession.mockResolvedValue(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns prefs and vlBatches for authenticated wallet", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    mockSqlReturns(
      [{ prefs: { slippageBps: 100, oddsFormat: "american" } }],
      [
        {
          vl_batch_id: "batch-uuid-1",
          budget_symbol: "USDC",
          amount: "1000",
          legs: [{ symbol: "ETH", price: "2000" }],
          expiration: 9999999999,
          created_at: 1700000000,
        },
      ],
    );

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.prefs.slippageBps).toBe(100);
    expect(body.vlBatches).toHaveLength(1);
    expect(body.vlBatches[0].vlBatchId).toBe("batch-uuid-1");
    // owner always comes from session, not body.
    expect(body.vlBatches[0].owner).toBe(address);
  });

  it("returns null prefs and empty vlBatches when no rows exist", async () => {
    const address = `0x${"b".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    mockSqlReturns([], []);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.prefs).toBeNull();
    expect(body.vlBatches).toEqual([]);
  });

  it("INVARIANT: session for wallet A reads only A data (not B)", async () => {
    const addressA = `0x${"a".repeat(40)}`;
    const addressB = `0x${"b".repeat(40)}`;

    // Session is for A.
    mockReadSession.mockResolvedValue({ address: addressA });

    // Capture what address was used in the sql call.
    const capturedAddresses: string[] = [];
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        // The address is always the first interpolated value in these queries.
        if (values[0] && typeof values[0] === "string") {
          capturedAddresses.push(values[0] as string);
        }
        return Promise.resolve([]);
      },
    );

    await GET(makeReq());

    // All captured addresses must be A, never B.
    expect(capturedAddresses.length).toBeGreaterThan(0);
    for (const addr of capturedAddresses) {
      expect(addr).toBe(addressA);
      expect(addr).not.toBe(addressB);
    }
  });

  it("returns 500 on db error", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db boom"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
