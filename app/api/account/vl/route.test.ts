/**
 * Tests for POST /api/account/vl
 *
 * Covers:
 *   (a) 401 without session
 *   (b) session for wallet A writes only to A (owner comes from session)
 *   (c) valid body returns vlBatches
 *   (d) body validation rejects malformed input
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/account/session", () => ({
  readSession: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  sql: vi.fn(),
}));

import { readSession } from "@/lib/account/session";
import { sql } from "@/lib/db/client";
import { POST } from "./route";

const mockReadSession = vi.mocked(readSession);
const mockSql = vi.mocked(sql);

const VALID_BODY = {
  vlBatchId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  budgetSymbol: "USDC",
  amount: "1000",
  legs: [{ symbol: "ETH", price: "2000" }],
  expiration: 9999999999,
  createdAt: 1700000000,
};

function makeReq(body: unknown, url = "http://localhost/api/account/vl"): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let sqlCallCount = 0;
function mockSqlSequence(...resultSets: unknown[][]) {
  sqlCallCount = 0;
  (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const rows = resultSets[sqlCallCount] ?? [];
    sqlCallCount++;
    return Promise.resolve(rows);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  sqlCallCount = 0;
  process.env.SESSION_JWT_SECRET = "a".repeat(64);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/account/vl", () => {
  it("returns 401 when readSession returns null", async () => {
    mockReadSession.mockResolvedValue(null);
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("stores batch and returns open vlBatches", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    // First call = INSERT (no return needed beyond []); second = SELECT open batches.
    mockSqlSequence(
      [],
      [
        {
          vl_batch_id: VALID_BODY.vlBatchId,
          budget_symbol: VALID_BODY.budgetSymbol,
          amount: VALID_BODY.amount,
          legs: VALID_BODY.legs,
          expiration: VALID_BODY.expiration,
          created_at: VALID_BODY.createdAt,
        },
      ],
    );

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.vlBatches).toHaveLength(1);
    expect(body.vlBatches[0].vlBatchId).toBe(VALID_BODY.vlBatchId);
    // Owner must come from session, not the body.
    expect(body.vlBatches[0].owner).toBe(address);
  });

  it("rejects missing vlBatchId with 400", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const { vlBatchId: _omit, ...noId } = VALID_BODY;
    const res = await POST(makeReq(noId));
    expect(res.status).toBe(400);
  });

  it("rejects non-uuid vlBatchId with 400", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await POST(makeReq({ ...VALID_BODY, vlBatchId: "not-a-uuid" }));
    expect(res.status).toBe(400);
  });

  it("rejects empty legs array with 400", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await POST(makeReq({ ...VALID_BODY, legs: [] }));
    expect(res.status).toBe(400);
  });

  it("INVARIANT: owner in response comes from session not body (even if body supplies owner)", async () => {
    const addressA = `0x${"a".repeat(40)}`;
    const addressB = `0x${"b".repeat(40)}`;

    mockReadSession.mockResolvedValue({ address: addressA });

    const capturedAddresses: string[] = [];
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        // In the INSERT the address is the 2nd positional value (after vlBatchId).
        for (const v of values) {
          if (typeof v === "string" && (v as string).startsWith("0x")) {
            capturedAddresses.push(v as string);
          }
        }
        return Promise.resolve([]);
      },
    );

    // Include owner in body (should be ignored by the route).
    await POST(makeReq({ ...VALID_BODY, owner: addressB }));

    // All 0x addresses passed to sql must be A.
    for (const addr of capturedAddresses) {
      expect(addr).toBe(addressA);
      expect(addr).not.toBe(addressB);
    }
  });

  it("returns 500 on db error", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(500);
  });
});
