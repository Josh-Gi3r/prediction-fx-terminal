/**
 * lib/peer/depositReceipt.test.ts
 *
 * Unit tests for resolveDepositIdFromReceipt.
 *
 * No network — receipt is mocked; logs are built with viem's own
 * encodeEventTopics + encodeAbiParameters so the ABI is the ground truth.
 *
 * Covers:
 *   1. Positive match via escrowAbi
 *   2. Depositor mismatch → null
 *   3. No matching event name in logs → null
 *   4. Positive match falls back to escrowV2Abi when escrowAbi produces no hit
 */

import { encodeAbiParameters, encodeEventTopics } from "viem";
import { describe, expect, it, vi } from "vitest";

// ─── Mock @wagmi/core before importing the module under test ─────────────────
// We intercept waitForTransactionReceipt so no real RPC call is made.

vi.mock("@wagmi/core", () => ({
  waitForTransactionReceipt: vi.fn(),
}));

import { waitForTransactionReceipt } from "@wagmi/core";
import { resolveDepositIdFromReceipt } from "./depositReceipt";

// ─── ABI fixture (matches the shape in zkp2p SDK dist) ───────────────────────

const DEPOSIT_RECEIVED_EVENT = {
  anonymous: false,
  type: "event" as const,
  name: "DepositReceived",
  inputs: [
    { indexed: true, name: "depositId", type: "uint256" },
    { indexed: true, name: "depositor", type: "address" },
    { indexed: true, name: "token", type: "address" },
    { indexed: false, name: "amount", type: "uint256" },
    {
      indexed: false,
      name: "intentAmountRange",
      type: "tuple",
      components: [
        { name: "min", type: "uint256" },
        { name: "max", type: "uint256" },
      ],
    },
    { indexed: false, name: "delegate", type: "address" },
    { indexed: false, name: "intentGuardian", type: "address" },
  ],
} as const;

const ESCROW_ABI = [DEPOSIT_RECEIVED_EVENT] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEPOSITOR = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
const OTHER_ADDR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`;
const TOKEN = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as `0x${string}`;
const DEPOSIT_ID = 99n;

/** Build a synthetic raw log for DepositReceived. */
function makeDepositReceivedLog(
  abi: typeof ESCROW_ABI,
  depositId: bigint,
  depositor: `0x${string}`,
  token: `0x${string}`,
) {
  const topics = encodeEventTopics({
    abi,
    eventName: "DepositReceived",
    args: { depositId, depositor, token },
  });

  const data = encodeAbiParameters(
    [
      { name: "amount", type: "uint256" },
      {
        name: "intentAmountRange",
        type: "tuple",
        components: [
          { name: "min", type: "uint256" },
          { name: "max", type: "uint256" },
        ],
      },
      { name: "delegate", type: "address" },
      { name: "intentGuardian", type: "address" },
    ],
    [
      1_000_000n,
      { min: 1_000n, max: 5_000_000n },
      "0x0000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000",
    ],
  );

  return {
    address: token,
    topics,
    data,
    blockHash: "0xabc" as `0x${string}`,
    blockNumber: 100n,
    logIndex: 0,
    transactionHash: "0xdef" as `0x${string}`,
    transactionIndex: 0,
    removed: false,
  };
}

/** Build a mock Zkp2pClient with the given ABIs. */
function makeClient(opts: {
  escrowAbi: typeof ESCROW_ABI;
  escrowV2Abi?: typeof ESCROW_ABI;
}) {
  return {
    escrowAbi: opts.escrowAbi,
    escrowV2Abi: opts.escrowV2Abi,
  } as unknown as import("@zkp2p/sdk").Zkp2pClient;
}

const DUMMY_HASH = `0x${"a".repeat(64)}` as `0x${string}`;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("resolveDepositIdFromReceipt", () => {
  it("returns depositId when escrowAbi matches the depositor", async () => {
    const log = makeDepositReceivedLog(ESCROW_ABI, DEPOSIT_ID, DEPOSITOR, TOKEN);
    vi.mocked(waitForTransactionReceipt).mockResolvedValueOnce({
      logs: [log],
    } as never);

    const result = await resolveDepositIdFromReceipt(
      makeClient({ escrowAbi: ESCROW_ABI }),
      DUMMY_HASH,
      DEPOSITOR,
    );

    expect(result).toBe(DEPOSIT_ID);
  });

  it("returns null when depositor does not match", async () => {
    // Log emitted for OTHER_ADDR, but we query for DEPOSITOR
    const log = makeDepositReceivedLog(ESCROW_ABI, DEPOSIT_ID, OTHER_ADDR, TOKEN);
    vi.mocked(waitForTransactionReceipt).mockResolvedValueOnce({
      logs: [log],
    } as never);

    const result = await resolveDepositIdFromReceipt(
      makeClient({ escrowAbi: ESCROW_ABI }),
      DUMMY_HASH,
      DEPOSITOR,
    );

    expect(result).toBeNull();
  });

  it("returns null when receipt has no DepositReceived log", async () => {
    // Provide a log with a different topic signature (e.g. Transfer)
    const unrelatedLog = {
      address: TOKEN,
      topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef" as `0x${string}`,
      ],
      data: "0x",
      blockHash: "0xabc" as `0x${string}`,
      blockNumber: 100n,
      logIndex: 0,
      transactionHash: "0xdef" as `0x${string}`,
      transactionIndex: 0,
      removed: false,
    };

    vi.mocked(waitForTransactionReceipt).mockResolvedValueOnce({
      logs: [unrelatedLog],
    } as never);

    const result = await resolveDepositIdFromReceipt(
      makeClient({ escrowAbi: ESCROW_ABI }),
      DUMMY_HASH,
      DEPOSITOR,
    );

    expect(result).toBeNull();
  });

  it("falls back to escrowV2Abi and returns depositId when primary ABI has no match", async () => {
    // Primary ABI has no matching event (empty logs for the primary escrow),
    // but escrowV2Abi carries the correct log.
    const log = makeDepositReceivedLog(ESCROW_ABI, DEPOSIT_ID, DEPOSITOR, TOKEN);

    // The mock receipt has one log that is only parseable by escrowV2Abi.
    // We simulate the "primary has no match" by providing an escrowAbi with
    // no DepositReceived entry — the try/catch in the implementation falls
    // through to the v2 path.
    const emptyAbi = [] as unknown as typeof ESCROW_ABI;

    vi.mocked(waitForTransactionReceipt).mockResolvedValueOnce({
      logs: [log],
    } as never);

    const result = await resolveDepositIdFromReceipt(
      makeClient({ escrowAbi: emptyAbi, escrowV2Abi: ESCROW_ABI }),
      DUMMY_HASH,
      DEPOSITOR,
    );

    expect(result).toBe(DEPOSIT_ID);
  });
});
