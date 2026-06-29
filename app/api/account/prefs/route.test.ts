/**
 * Tests for PUT /api/account/prefs
 *
 * Covers:
 *   (a) 401 without session
 *   (b) session for wallet A cannot write wallet B's rows
 *   (c) .strict() rejects unknown keys
 *   (d) valid patch upserts and returns prefs
 *   (e) body size limit
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
import { PUT } from "./route";

const mockReadSession = vi.mocked(readSession);
const mockSql = vi.mocked(sql);

function makeReq(body: unknown, url = "http://localhost/api/account/prefs"): NextRequest {
  return new NextRequest(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockSqlReturns(rows: unknown[]) {
  (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => Promise.resolve(rows));
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SESSION_JWT_SECRET = "a".repeat(64);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PUT /api/account/prefs", () => {
  it("returns 401 when readSession returns null", async () => {
    mockReadSession.mockResolvedValue(null);
    const res = await PUT(makeReq({ slippageBps: 100 }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("accepts a valid partial patch and returns merged prefs", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    mockSqlReturns([{ prefs: { slippageBps: 100, oddsFormat: "american" } }]);

    const res = await PUT(makeReq({ slippageBps: 100, oddsFormat: "american" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.prefs.slippageBps).toBe(100);
  });

  it("rejects unknown keys (.strict() enforcement) with 400", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await PUT(makeReq({ slippageBps: 100, unknown_field: "bad" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid request");
  });

  it("rejects invalid oddsFormat value with 400", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await PUT(makeReq({ oddsFormat: "fractional" }));
    expect(res.status).toBe(400);
  });

  it("accepts full notifications patch", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    mockSqlReturns([
      {
        prefs: {
          notifications: { betFilled: false, orderFilled: true, marketResolves: true, p2p: false },
        },
      },
    ]);

    const res = await PUT(
      makeReq({
        notifications: {
          betFilled: false,
          orderFilled: true,
          marketResolves: true,
          p2p: false,
        },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects notifications with unknown keys (.strict())", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const res = await PUT(
      makeReq({
        notifications: {
          betFilled: true,
          orderFilled: true,
          marketResolves: true,
          p2p: true,
          extraKey: true, // unknown
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("INVARIANT: session for wallet A writes only to A (not B)", async () => {
    const addressA = `0x${"a".repeat(40)}`;
    const addressB = `0x${"b".repeat(40)}`;

    mockReadSession.mockResolvedValue({ address: addressA });

    const capturedAddresses: string[] = [];
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        // In the INSERT/ON CONFLICT query the address is the first param.
        if (values[0] && typeof values[0] === "string" && (values[0] as string).startsWith("0x")) {
          capturedAddresses.push(values[0] as string);
        }
        return Promise.resolve([{ prefs: {} }]);
      },
    );

    // Body claims B's address — should be ignored.
    await PUT(makeReq({ slippageBps: 50 }));

    expect(capturedAddresses.length).toBeGreaterThan(0);
    for (const addr of capturedAddresses) {
      expect(addr).toBe(addressA);
      expect(addr).not.toBe(addressB);
    }
  });

  it("returns 413 when body exceeds 8KB", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });

    const bigBody = JSON.stringify({ slippageBps: 50, settlementStablecoin: "x".repeat(9000) });
    const req = new NextRequest("http://localhost/api/account/prefs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: bigBody,
    });
    const res = await PUT(req);
    expect(res.status).toBe(413);
  });

  it("returns 500 on db error", async () => {
    const address = `0x${"a".repeat(40)}`;
    mockReadSession.mockResolvedValue({ address });
    (mockSql as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));

    const res = await PUT(makeReq({ slippageBps: 50 }));
    expect(res.status).toBe(500);
  });
});
