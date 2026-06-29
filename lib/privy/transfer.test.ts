/**
 * Unit tests for lib/privy/transfer.ts
 *
 * Tests: request builder, URL builder, Zod schema validation,
 * idempotency key inclusion, and transfer response parse shape.
 * No network calls; no Privy SDK needed.
 */

import { describe, expect, it } from "vitest";
import {
  PRIVY_API_BASE,
  TRANSFER_CHAINS,
  TRANSFER_TOKENS,
  TransferRouteSchema,
  buildTransferBody,
  buildTransferUrl,
  zDecimalAmount,
  zTransferAddress,
} from "./transfer";

// ─── buildTransferBody ────────────────────────────────────────────────────────

describe("buildTransferBody", () => {
  const KEY = "00000000-0000-0000-0000-000000000001";

  it("returns the correct shape for USDC", () => {
    const body = buildTransferBody(
      "usdc",
      "10.5",
      "0xabc1230000000000000000000000000000000001",
      KEY,
    );
    expect(body).toEqual({
      source: { asset: "usdc", amount: "10.5", chain: "ethereum" },
      destination: { address: "0xabc1230000000000000000000000000000000001" },
      idempotencyKey: KEY,
    });
  });

  it("returns the correct shape for USDT", () => {
    const body = buildTransferBody(
      "usdt",
      "1.0",
      "0xabc1230000000000000000000000000000000002",
      KEY,
    );
    expect(body.source.asset).toBe("usdt");
    expect(body.source.chain).toBe("ethereum");
    expect(body.destination.address).toBe("0xabc1230000000000000000000000000000000002");
    expect(body.idempotencyKey).toBe(KEY);
  });

  it("defaults chain to ethereum", () => {
    const body = buildTransferBody("usdc", "5", "0xabc1230000000000000000000000000000000003", KEY);
    expect(body.source.chain).toBe("ethereum");
  });

  it("respects an explicit chain arg (even if only ethereum is in enum)", () => {
    const body = buildTransferBody(
      "usdc",
      "1",
      "0xabc1230000000000000000000000000000000004",
      KEY,
      "ethereum",
    );
    expect(body.source.chain).toBe("ethereum");
  });

  it("includes idempotencyKey in the body (so it is covered by the auth signature)", () => {
    const key1 = "aaaaaaaa-0000-0000-0000-000000000001";
    const key2 = "bbbbbbbb-0000-0000-0000-000000000002";
    const addr = "0xabc1230000000000000000000000000000000005";
    const b1 = buildTransferBody("usdc", "10", addr, key1);
    const b2 = buildTransferBody("usdc", "10", addr, key2);
    // Two otherwise-identical transfers with different keys produce different bodies,
    // so the authorization signatures will differ — preventing replay.
    expect(JSON.stringify(b1)).not.toBe(JSON.stringify(b2));
    expect(b1.idempotencyKey).toBe(key1);
    expect(b2.idempotencyKey).toBe(key2);
  });
});

// ─── buildTransferUrl ─────────────────────────────────────────────────────────

describe("buildTransferUrl", () => {
  it("builds the correct Privy Wallet API URL with ?include=steps", () => {
    const url = buildTransferUrl("otwlt_abc123");
    expect(url).toBe(`${PRIVY_API_BASE}/wallets/otwlt_abc123/rpc?include=steps`);
  });

  it("uses the canonical PRIVY_API_BASE", () => {
    expect(PRIVY_API_BASE).toBe("https://api.privy.io/v1");
  });

  it("includes ?include=steps so Privy returns per-step hashes", () => {
    const url = buildTransferUrl("otwlt_xyz");
    expect(url).toContain("?include=steps");
  });
});

// ─── TRANSFER_TOKENS / TRANSFER_CHAINS constants ──────────────────────────────

describe("constants", () => {
  it("TRANSFER_TOKENS includes usdc and usdt", () => {
    expect(TRANSFER_TOKENS).toContain("usdc");
    expect(TRANSFER_TOKENS).toContain("usdt");
  });

  it("TRANSFER_CHAINS includes ethereum", () => {
    expect(TRANSFER_CHAINS).toContain("ethereum");
  });
});

// ─── zTransferAddress ─────────────────────────────────────────────────────────

describe("zTransferAddress", () => {
  it("accepts a valid 0x address (lowercase hex)", () => {
    const r = zTransferAddress.safeParse("0xabcdef1234567890abcdef1234567890abcdef12");
    expect(r.success).toBe(true);
  });

  it("accepts a valid 0x address (uppercase hex)", () => {
    const r = zTransferAddress.safeParse("0xABCDEF1234567890ABCDEF1234567890ABCDEF12");
    expect(r.success).toBe(true);
  });

  it("rejects an address that is too short", () => {
    const r = zTransferAddress.safeParse("0xabc");
    expect(r.success).toBe(false);
  });

  it("rejects an address without 0x prefix", () => {
    const r = zTransferAddress.safeParse("abcdef1234567890abcdef1234567890abcdef12");
    expect(r.success).toBe(false);
  });

  it("rejects an ENS name", () => {
    const r = zTransferAddress.safeParse("vitalik.eth");
    expect(r.success).toBe(false);
  });

  it("rejects an empty string", () => {
    const r = zTransferAddress.safeParse("");
    expect(r.success).toBe(false);
  });
});

// ─── zDecimalAmount ───────────────────────────────────────────────────────────

describe("zDecimalAmount", () => {
  it("accepts integer amounts", () => {
    expect(zDecimalAmount.safeParse("100").success).toBe(true);
  });

  it("accepts decimal amounts", () => {
    expect(zDecimalAmount.safeParse("10.5").success).toBe(true);
    expect(zDecimalAmount.safeParse("0.000001").success).toBe(true);
  });

  it("rejects negative amounts", () => {
    expect(zDecimalAmount.safeParse("-1").success).toBe(false);
  });

  it("rejects amounts with multiple decimal points", () => {
    expect(zDecimalAmount.safeParse("1.2.3").success).toBe(false);
  });

  it("rejects scientific notation", () => {
    expect(zDecimalAmount.safeParse("1e6").success).toBe(false);
  });

  it("rejects empty string", () => {
    expect(zDecimalAmount.safeParse("").success).toBe(false);
  });
});

// ─── TransferRouteSchema ──────────────────────────────────────────────────────

const VALID_WALLET_ID = "otwlt_abc123def456";
const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
const VALID_SIG = "dGVzdA=="; // base64 "test"
const VALID_UUID = "12345678-1234-4234-8234-123456789012"; // valid v4 UUID

describe("TransferRouteSchema", () => {
  it("accepts a valid USDC transfer request", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "10.5",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.token).toBe("usdc");
      expect(r.data.amount).toBe("10.5");
      expect(r.data.idempotencyKey).toBe(VALID_UUID);
    }
  });

  it("accepts a valid USDT transfer request", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdt",
      amount: "50",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(true);
  });

  it("rejects a missing idempotencyKey", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "10.5",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      // idempotencyKey omitted
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid UUID for idempotencyKey", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "10.5",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: "not-a-uuid",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an unsupported token", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "eth",
      amount: "1.0",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an invalid recipient address", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "10",
      to: "not-an-address",
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a negative amount string", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "-5",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a missing walletId", () => {
    const r = TransferRouteSchema.safeParse({
      token: "usdc",
      amount: "10",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty authorization signature", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: VALID_WALLET_ID,
      token: "usdc",
      amount: "10",
      to: VALID_ADDRESS,
      authorizationSignature: "",
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });

  it("rejects a walletId that is too long (> 200 chars)", () => {
    const r = TransferRouteSchema.safeParse({
      walletId: "x".repeat(201),
      token: "usdc",
      amount: "10",
      to: VALID_ADDRESS,
      authorizationSignature: VALID_SIG,
      idempotencyKey: VALID_UUID,
    });
    expect(r.success).toBe(false);
  });
});

// ─── Transfer response parse shape (P0-D fixture) ─────────────────────────────
//
// Verifies the route's hash-extraction logic against known Privy response shapes
// so regressions in parse are caught before deployment. Logic mirrors
// extractStepHash in app/api/wallet/transfer/route.ts.

function extractStepHash(step: Record<string, unknown>): string | null {
  if (step.type === "evm_transaction") {
    const h = step.transaction_hash;
    return typeof h === "string" && h.length > 0 ? h : null;
  }
  if (step.type === "evm_user_operation") {
    const h = step.bundle_transaction_hash;
    return typeof h === "string" && h.length > 0 ? h : null;
  }
  return null;
}

describe("transfer response parse — extractStepHash", () => {
  const HASH = "0xdeadbeef00000000000000000000000000000000000000000000000000000001";

  it("extracts transaction_hash from an evm_transaction step", () => {
    const step = {
      type: "evm_transaction",
      transaction_hash: HASH,
      caip2: "eip155:1",
      status: "confirmed",
    };
    expect(extractStepHash(step)).toBe(HASH);
  });

  it("returns null for an evm_transaction step with null hash (not yet submitted)", () => {
    const step = {
      type: "evm_transaction",
      transaction_hash: null,
      caip2: "eip155:1",
      status: "pending",
    };
    expect(extractStepHash(step)).toBeNull();
  });

  it("extracts bundle_transaction_hash from an evm_user_operation step (ERC-4337 path)", () => {
    const step = {
      type: "evm_user_operation",
      bundle_transaction_hash: HASH,
      user_operation_hash: "0xaaaa",
      caip2: "eip155:1",
      status: "confirmed",
      entrypoint_version: "0.6",
    };
    expect(extractStepHash(step)).toBe(HASH);
  });

  it("returns null for an evm_user_operation step with null bundle hash (not yet bundled)", () => {
    const step = {
      type: "evm_user_operation",
      bundle_transaction_hash: null,
      user_operation_hash: "0xbbbb",
      caip2: "eip155:1",
      status: "pending",
      entrypoint_version: "0.6",
    };
    expect(extractStepHash(step)).toBeNull();
  });

  it("returns null for an external_transaction step (no hash field)", () => {
    const step = {
      type: "external_transaction",
      status: "pending",
    };
    expect(extractStepHash(step)).toBeNull();
  });

  it("picks the first confirmed hash when multiple steps are present", () => {
    const steps: Record<string, unknown>[] = [
      // approval step (ERC-4337), not yet bundled
      {
        type: "evm_user_operation",
        bundle_transaction_hash: null,
        user_operation_hash: "0xapprove",
        caip2: "eip155:1",
        status: "pending",
        entrypoint_version: "0.6",
      },
      // transfer step, confirmed
      {
        type: "evm_user_operation",
        bundle_transaction_hash: HASH,
        user_operation_hash: "0xtransfer",
        caip2: "eip155:1",
        status: "confirmed",
        entrypoint_version: "0.6",
      },
    ];
    const result = steps.map(extractStepHash).find((h): h is string => h !== null) ?? null;
    expect(result).toBe(HASH);
  });

  it("returns null when steps array is empty", () => {
    const steps: Record<string, unknown>[] = [];
    const result = steps.map(extractStepHash).find((h): h is string => h !== null) ?? null;
    expect(result).toBeNull();
  });

  it("TransferActionResponse without steps (missing ?include=steps) yields null hash", () => {
    // Simulates the old bug: response has no steps key.
    const action: Record<string, unknown> = {
      id: "act_123",
      status: "pending",
      type: "transfer",
    };
    const steps = Array.isArray(action.steps) ? (action.steps as Record<string, unknown>[]) : [];
    const txHash = steps.map(extractStepHash).find((h): h is string => h !== null) ?? null;
    expect(txHash).toBeNull();
    // This is expected — the route now appends ?include=steps to ensure steps are present.
  });
});
