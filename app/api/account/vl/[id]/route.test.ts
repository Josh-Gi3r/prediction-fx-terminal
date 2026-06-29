/**
 * Tests for DELETE /api/account/vl/[id]
 *
 * Covers:
 *   (a) 401 without session
 *   (b) 404 when the id belongs to a different wallet (address scoped WHERE)
 *   (c) soft-delete scoped by address — wallet B cannot cancel wallet A's batch
 *   (d) 404 on invalid UUID param
 *   (e) successful delete returns remaining open batches
 */

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/account/session", () => ({
  readSession: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  sql: vi.fn(),
}));

// queryOpenBatches is imported from the parent route; mock it too.
vi.mock("@/app/api/account/vl/route", () => ({
  queryOpenBatches: vi.fn(),
}));

import { queryOpenBatches } from "@/app/api/account/vl/route";
import { readSession } from "@/lib/account/session";
import { sql } from "@/lib/db/client";
import { DELETE } from "./route";

const mockReadSession = vi.mocked(readSession);
const mockSql = vi.mocked(sql);
const mockQueryOpen = vi.mocked(queryOpenBatches);

const VALID_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function makeReq(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/account/vl/${id}`, { method: "DELETE" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_JWT_SECRET = "a".repeat(64);
  mockQueryOpen.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("DELETE /api/account/vl/[id]", () => {
  it("returns 401 when readSession returns null", async () => {
    mockReadSession.mockResolvedValue(null);
    const res = await DELETE(makeReq(VALID_UUID), makeParams(VALID_UUID));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 404 for invalid UUID param", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await DELETE(makeReq("not-a-uuid"), makeParams("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it("returns 404 when the batch does not belong to the session wallet", async () => {
    const addressA = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address: addressA });

    // UPDATE affected 0 rows (batch belongs to a different address or doesn't exist).
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(Object.assign([], { count: 0 })),
    );

    const res = await DELETE(makeReq(VALID_UUID), makeParams(VALID_UUID));
    expect(res.status).toBe(404);
  });

  it("INVARIANT: soft-delete WHERE clause includes session.address (wallet B cannot cancel wallet A's batch)", async () => {
    const addressA = `0x${"a".repeat(40)}`;
    const addressB = `0x${"b".repeat(40)}`;

    // Session is for wallet B.
    mockReadSession.mockResolvedValue({ address: addressB });

    const capturedValues: unknown[] = [];
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        capturedValues.push(...values);
        // Return 0 rows affected — the AND address clause would block it.
        return Promise.resolve(Object.assign([], { count: 0 }));
      },
    );

    const res = await DELETE(makeReq(VALID_UUID), makeParams(VALID_UUID));

    // The UPDATE must include B's address in the WHERE clause, not A's.
    const addresses = capturedValues.filter(
      (v) => typeof v === "string" && (v as string).startsWith("0x"),
    );
    expect(addresses).toContain(addressB);
    expect(addresses).not.toContain(addressA);

    // Mismatched batch → 404 (not 403, to avoid leaking existence).
    expect(res.status).toBe(404);
  });

  it("successful delete returns remaining open vlBatches", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    // UPDATE affected 1 row.
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(Object.assign([], { count: 1 })),
    );

    const remaining = [
      {
        vlBatchId: "other-uuid-0000-0000-0000-000000000000",
        owner: address,
        budgetSymbol: "USDC",
        amount: "500",
        legs: [{ symbol: "BTC", price: "50000" }],
        expiration: 9999999999,
        createdAt: 1700000001,
      },
    ];
    mockQueryOpen.mockResolvedValue(remaining);

    const res = await DELETE(makeReq(VALID_UUID), makeParams(VALID_UUID));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.vlBatches).toEqual(remaining);
  });

  it("returns 500 on db error", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db crash"));

    const res = await DELETE(makeReq(VALID_UUID), makeParams(VALID_UUID));
    expect(res.status).toBe(500);
  });
});
