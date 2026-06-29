/**
 * tests/fork/execution.test.ts
 *
 * Mainnet-fork execution tests. Each test builds REAL calldata and executes
 * it against an anvil fork with a funded test account. No mocks at the
 * boundary that matters.
 *
 * What this catches (that unit tests cannot):
 * - Missing ERC-20 approve before a swap (TRANSFER_FROM_FAILED revert class)
 * - LiFi/Kyber router rejecting under-approved amounts
 * - EIP-2612 permit construction that doesn't match the live contract
 * - Polygon USDC.e approve to CTF Exchange (Polymarket gate)
 * - Kyber build calldata that is structurally invalid on-chain
 *
 * Skip behaviour:
 * - If anvil is not installed: all tests skip with a loud warning.
 * - If RPC unreachable: all tests skip with a loud warning.
 * - If a live API (LiFi, Kyber) returns no route: that specific test skips.
 *
 * Run:  bun run test:fork
 */

import { privateKeyToAccount } from "viem/accounts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getContractConfig } from "@/lib/polymarket/order";
import { USDC_E_POLYGON } from "@/lib/polymarket/useUsdcApproval";
import { buildPermitTypedData } from "@/lib/fx-provider/core/intent";
import type { PermitEnvelope } from "@/lib/fx-provider/core/types";
import { kyberServerQuote } from "@/lib/server/quotes/kyber";
import { lifiServerQuote } from "@/lib/server/quotes/lifi";

import {
  type AnvilHandle,
  ETH_FORK_RPC,
  FORK_ETH_PORT,
  FORK_POLY_PORT,
  POLY_FORK_RPC,
  TEST_ADDRESS,
  TEST_PRIVATE_KEY,
  USDC_MAINNET,
  USDT_MAINNET,
  checkAnvil,
  encodeApprove,
  fundEth,
  fundUsdc,
  fundUsdcEPolygon,
  fundUsdt,
  getCode,
  isRpcReachable,
  readErc20Allowance,
  readErc20Balance,
  rpcCall,
  sendAndWait,
  simulateTx,
  spawnAnvil,
} from "./harness";

// ─── Globals ──────────────────────────────────────────────────────────────────

let ethFork: AnvilHandle | null = null;
let polyFork: AnvilHandle | null = null;
let skipAll = false;
let skipReason = "";

// Token amounts for the test account
const USDC_FUND_RAW = 10_000_000n; // 10 USDC (6 decimals)
const USDT_FUND_RAW = 10_000_000n; // 10 USDT
const USDC_E_FUND_RAW = 10_000_000n; // 10 USDC.e on Polygon

// Swap params: 5 USDC → USDT on Ethereum mainnet
const SWAP_FROM = USDC_MAINNET;
const SWAP_TO = USDT_MAINNET;
const SWAP_AMOUNT_RAW = "5000000"; // 5 USDC
const FROM_DECIMALS = 6;
const TO_DECIMALS = 6;

// Polymarket CTF Exchange on Polygon (from lib/polymarket/order.ts getContractConfig)
const { exchange: CTF_EXCHANGE_POLYGON } = getContractConfig(137);

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  // Check anvil binary
  try {
    const ver = await checkAnvil();
    console.log(`[fork] anvil: ${ver}`);
  } catch (e) {
    skipAll = true;
    skipReason = `anvil not installed — ${(e as Error).message}`;
    console.warn(`\n[fork] SKIP: ${skipReason}\n`);
    return;
  }

  // Check RPC reachability
  const [ethOk, polyOk] = await Promise.all([
    isRpcReachable(ETH_FORK_RPC),
    isRpcReachable(POLY_FORK_RPC),
  ]);
  if (!ethOk) {
    skipAll = true;
    skipReason = `Ethereum RPC unreachable: ${ETH_FORK_RPC}`;
    console.warn(`\n[fork] SKIP: ${skipReason}\n`);
    return;
  }
  if (!polyOk) {
    skipAll = true;
    skipReason = `Polygon RPC unreachable: ${POLY_FORK_RPC}`;
    console.warn(`\n[fork] SKIP: ${skipReason}\n`);
    return;
  }

  console.log("[fork] spawning Ethereum mainnet fork...");
  ethFork = await spawnAnvil({ forkUrl: ETH_FORK_RPC, port: FORK_ETH_PORT });

  console.log("[fork] spawning Polygon mainnet fork...");
  polyFork = await spawnAnvil({
    forkUrl: POLY_FORK_RPC,
    port: FORK_POLY_PORT,
    chainId: 137,
  });

  // Fund ETH for gas on both forks
  await fundEth(ethFork, 5);
  await fundEth(polyFork, 5);

  // Fund tokens
  await fundUsdc(ethFork, USDC_FUND_RAW);
  await fundUsdt(ethFork, USDT_FUND_RAW);
  await fundUsdcEPolygon(polyFork, USDC_E_FUND_RAW);

  console.log("[fork] forks ready, accounts funded");
  console.log(`[fork] test address: ${TEST_ADDRESS}`);
}, 60_000);

afterAll(() => {
  ethFork?.stop();
  polyFork?.stop();
  ethFork = null;
  polyFork = null;
});

// ─── TEST A: ERC-20 approve + transferFrom sanity (harness smoke) ──────────────

describe("A: ERC-20 harness smoke", () => {
  it("A1: sets USDC balance correctly via storage slot write", async () => {
    if (skipAll) {
      console.warn(`[fork/A1] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;
    const balance = await readErc20Balance(fork, USDC_MAINNET, TEST_ADDRESS);
    expect(balance).toBeGreaterThanOrEqual(USDC_FUND_RAW);
    console.log(`[fork/A1] USDC balance: ${balance} raw (${Number(balance) / 1e6} USDC)`);
  });

  it("A2: sets USDT balance correctly", async () => {
    if (skipAll) {
      console.warn(`[fork/A2] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;
    const balance = await readErc20Balance(fork, USDT_MAINNET, TEST_ADDRESS);
    expect(balance).toBeGreaterThanOrEqual(USDT_FUND_RAW);
    console.log(`[fork/A2] USDT balance: ${balance} raw (${Number(balance) / 1e6} USDT)`);
  });

  it("A3: approve sets allowance; second approve to zero resets it", async () => {
    if (skipAll) {
      console.warn(`[fork/A3] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;
    const DUMMY_SPENDER = "0x1111111111111111111111111111111111111111" as const;
    const approveAmount = 999_000n;

    const approveData = encodeApprove(DUMMY_SPENDER, approveAmount);
    const { status } = await sendAndWait(fork, USDC_MAINNET, approveData);
    expect(status).toBe("success");

    const allowance = await readErc20Allowance(fork, USDC_MAINNET, TEST_ADDRESS, DUMMY_SPENDER);
    expect(allowance).toBe(approveAmount);
    console.log(`[fork/A3] USDC allowance after approve: ${allowance}`);

    // Reset to zero
    const resetData = encodeApprove(DUMMY_SPENDER, 0n);
    const { status: s2 } = await sendAndWait(fork, USDC_MAINNET, resetData);
    expect(s2).toBe("success");
    const allowanceAfterReset = await readErc20Allowance(
      fork,
      USDC_MAINNET,
      TEST_ADDRESS,
      DUMMY_SPENDER,
    );
    expect(allowanceAfterReset).toBe(0n);
    console.log("[fork/A3] USDC allowance reset to 0: confirmed");
  });
});

// ─── TEST B: LiFi path ────────────────────────────────────────────────────────

describe("B: LiFi path — approve mechanics + execution", () => {
  it("B1: without approve — swap tx reverts (locks the TRANSFER_FROM_FAILED bug class)", async () => {
    if (skipAll) {
      console.warn(`[fork/B1] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;

    const quoteResult = await lifiServerQuote({
      fromAddress: SWAP_FROM,
      toAddress: SWAP_TO,
      fromAmountRaw: SWAP_AMOUNT_RAW,
      fromDecimals: FROM_DECIMALS,
      toDecimals: TO_DECIMALS,
      owner: TEST_ADDRESS,
    });

    if (!quoteResult.ok) {
      console.warn(`[fork/B1] SKIP: LiFi returned no route — ${quoteResult.message}`);
      return;
    }

    const quote = quoteResult.quote;
    if (quote.source !== "lifi" || !quote.transactionRequest?.to) {
      console.warn("[fork/B1] SKIP: LiFi quote has no transactionRequest");
      return;
    }

    const tx = quote.transactionRequest;
    const to = tx.to as `0x${string}`;
    const data = (tx.data ?? "0x") as `0x${string}`;
    const value = tx.value ? BigInt(tx.value) : 0n;

    // IMPORTANT: deliberately NO approve here.
    const { willRevert, revertReason } = await simulateTx(fork, TEST_ADDRESS, to, data, value);

    console.log(
      `[fork/B1] LiFi without approve — willRevert: ${willRevert}, reason: "${revertReason}"`,
    );
    console.log(`[fork/B1] LiFi tool: ${quote.toolName}, spender: ${quote.approvalAddress}`);

    // Regression lock: without approval, the swap MUST revert.
    expect(willRevert).toBe(true);
  });

  it("B2: with exact approve — swap executes, USDT balance delta > 0", async () => {
    if (skipAll) {
      console.warn(`[fork/B2] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;

    const quoteResult = await lifiServerQuote({
      fromAddress: SWAP_FROM,
      toAddress: SWAP_TO,
      fromAmountRaw: SWAP_AMOUNT_RAW,
      fromDecimals: FROM_DECIMALS,
      toDecimals: TO_DECIMALS,
      owner: TEST_ADDRESS,
    });

    if (!quoteResult.ok) {
      console.warn(`[fork/B2] SKIP: LiFi returned no route — ${quoteResult.message}`);
      return;
    }

    const quote = quoteResult.quote;
    if (quote.source !== "lifi" || !quote.transactionRequest?.to) {
      console.warn("[fork/B2] SKIP: LiFi quote has no transactionRequest");
      return;
    }

    const spender = (quote.approvalAddress ?? quote.transactionRequest.to) as `0x${string}`;
    const approveAmount = BigInt(quote.amountInRaw);

    console.log(`[fork/B2] LiFi spender: ${spender}`);
    console.log(`[fork/B2] LiFi tool: ${quote.toolName}`);
    console.log(`[fork/B2] approveAmount: ${approveAmount}`);

    // Step 1: approve exact input amount to LiFi spender
    const approveData = encodeApprove(spender, approveAmount);
    const { status: approveStatus } = await sendAndWait(fork, USDC_MAINNET, approveData);
    expect(approveStatus).toBe("success");
    console.log("[fork/B2] approve: success");

    // Step 2: record USDT balance before
    const balanceBefore = await readErc20Balance(fork, USDT_MAINNET, TEST_ADDRESS);

    // Step 3: execute swap
    const tx = quote.transactionRequest;
    const { status: swapStatus, txHash } = await sendAndWait(
      fork,
      tx.to as `0x${string}`,
      (tx.data ?? "0x") as `0x${string}`,
      tx.value ? BigInt(tx.value) : 0n,
    );

    // Step 4: balance delta
    const balanceAfter = await readErc20Balance(fork, USDT_MAINNET, TEST_ADDRESS);
    const delta = balanceAfter - balanceBefore;

    console.log(`[fork/B2] swap status: ${swapStatus}, txHash: ${txHash}`);
    console.log(
      `[fork/B2] USDT before: ${balanceBefore}, after: ${balanceAfter}, delta: ${delta} raw (${Number(delta) / 1e6} USDT)`,
    );

    expect(swapStatus).toBe("success");
    expect(delta).toBeGreaterThan(0n);
  });
});

// ─── TEST C: Kyber path ───────────────────────────────────────────────────────

describe("C: Kyber path — approve + build calldata + execution", () => {
  it("C1: fetch quote, build calldata via KyberSwap API, approve + execute", async () => {
    if (skipAll) {
      console.warn(`[fork/C1] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;

    // Step 1: get route summary
    const quoteResult = await kyberServerQuote({
      fromAddress: SWAP_FROM,
      toAddress: SWAP_TO,
      fromAmountRaw: SWAP_AMOUNT_RAW,
      fromDecimals: FROM_DECIMALS,
      toDecimals: TO_DECIMALS,
    });

    if (!quoteResult.ok) {
      console.warn(`[fork/C1] SKIP: Kyber returned no route — ${quoteResult.message}`);
      return;
    }

    const quote = quoteResult.quote;
    if (quote.source !== "kyber" || !quote.routeSummary) {
      console.warn("[fork/C1] SKIP: Kyber quote has no routeSummary");
      return;
    }

    console.log(`[fork/C1] Kyber tool: ${quote.toolName}, amountOut: ${quote.amountOutRaw}`);

    // Step 2: build calldata
    const buildRes = await fetch(
      "https://aggregator-api.kyberswap.com/ethereum/api/v1/route/build",
      {
        method: "POST",
        headers: { "content-type": "application/json", "X-Client-Id": "predfx-terminal" },
        body: JSON.stringify({
          routeSummary: quote.routeSummary,
          sender: TEST_ADDRESS,
          recipient: TEST_ADDRESS,
          slippageTolerance: 50,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!buildRes.ok) {
      console.warn(`[fork/C1] SKIP: Kyber build HTTP ${buildRes.status}`);
      return;
    }

    const buildData = (await buildRes.json()) as {
      code?: number;
      data?: { routerAddress?: string; data?: string; amountOut?: string };
      message?: string;
    };

    if (buildData.code !== 0 || !buildData.data?.routerAddress || !buildData.data?.data) {
      console.warn(
        `[fork/C1] SKIP: Kyber build returned no calldata — ${buildData.message ?? JSON.stringify(buildData)}`,
      );
      return;
    }

    const routerAddress = buildData.data.routerAddress as `0x${string}`;
    const calldata = buildData.data.data as `0x${string}`;

    console.log(`[fork/C1] Kyber router: ${routerAddress}`);

    // Step 3: approve exact input to Kyber router
    const approveAmount = BigInt(SWAP_AMOUNT_RAW);
    const approveData = encodeApprove(routerAddress, approveAmount);
    const { status: approveStatus } = await sendAndWait(fork, USDC_MAINNET, approveData);
    expect(approveStatus).toBe("success");
    console.log("[fork/C1] approve: success");

    // Step 4: USDT balance before
    const balanceBefore = await readErc20Balance(fork, USDT_MAINNET, TEST_ADDRESS);

    // Step 5: execute swap
    const { status: swapStatus, txHash } = await sendAndWait(fork, routerAddress, calldata, 0n);

    // Step 6: balance delta
    const balanceAfter = await readErc20Balance(fork, USDT_MAINNET, TEST_ADDRESS);
    const delta = balanceAfter - balanceBefore;

    console.log(`[fork/C1] swap status: ${swapStatus}, txHash: ${txHash}`);
    console.log(`[fork/C1] USDT delta: ${delta} raw (${Number(delta) / 1e6} USDT)`);

    expect(swapStatus).toBe("success");
    expect(delta).toBeGreaterThan(0n);
  });
});

// ─── TEST D: FX Provider EIP-2612 permit on Ethereum fork ───────────────────────────

describe("D: FX Provider EIP-2612 permit on Ethereum fork", () => {
  it("D1: sign permit + call USDC.permit() on fork — allowance set", async () => {
    if (skipAll) {
      console.warn(`[fork/D1] SKIP: ${skipReason}`);
      return;
    }
    const fork = ethFork!;

    // Real FX provider mainnet spender (settlement_address from GET /api/config)
    const SETTLEMENT_CONTRACT = "0xB5C50C5D5f038404F85970b7f5B7259C4AC0E198" as const;
    const PERMIT_VALUE = 10_000_000n; // 10 USDC
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Read current USDC nonce for test account via nonces(address) selector 0x7ecebe00
    const noncesCalldata = `0x7ecebe00${TEST_ADDRESS.slice(2).toLowerCase().padStart(64, "0")}`;
    const nonceHex = (await rpcCall(fork.url, "eth_call", [
      { to: USDC_MAINNET, data: noncesCalldata },
      "latest",
    ])) as string;
    const nonce = Number(BigInt(nonceHex));

    console.log(`[fork/D1] USDC nonce for test account: ${nonce}`);

    // Build permit envelope using the same structure the app uses
    const permitEnvelope: PermitEnvelope = {
      permit_supported: true,
      permit_required: true,
      token: USDC_MAINNET,
      spender: SETTLEMENT_CONTRACT,
      owner: TEST_ADDRESS,
      value_raw: PERMIT_VALUE.toString(),
      current_allowance_raw: "0",
      nonce,
      suggested_deadline: deadline,
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 1,
        verifyingContract: USDC_MAINNET,
      },
      eip712: {
        domain: {
          name: "USD Coin",
          version: "2",
          chainId: 1,
          verifyingContract: USDC_MAINNET,
        },
        primaryType: "Permit",
        types: {
          Permit: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
        },
        message: {
          owner: TEST_ADDRESS,
          spender: SETTLEMENT_CONTRACT,
          value: PERMIT_VALUE.toString(),
          nonce,
          deadline,
        },
      },
    };

    // Sign using the same buildPermitTypedData helper the app uses
    const td = buildPermitTypedData(permitEnvelope);
    const account = privateKeyToAccount(TEST_PRIVATE_KEY);
    const sig = await account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message,
    });

    // Decode v, r, s from 65-byte signature (32r + 32s + 1v)
    const sigBytes = sig.slice(2); // strip 0x
    const r = sigBytes.slice(0, 64);
    const s = sigBytes.slice(64, 128);
    const v = Number.parseInt(sigBytes.slice(128, 130), 16);

    function enc32(val: bigint | number | string): string {
      return BigInt(val).toString(16).padStart(64, "0");
    }
    function encAddr(addr: string): string {
      return addr.slice(2).toLowerCase().padStart(64, "0");
    }

    // permit(owner, spender, value, deadline, v, r, s) selector: 0xd505accf
    const permitCalldata = `0xd505accf${encAddr(TEST_ADDRESS)}${encAddr(SETTLEMENT_CONTRACT)}${enc32(PERMIT_VALUE)}${enc32(deadline)}${enc32(v)}${r}${s}`;

    const { status: permitStatus } = await sendAndWait(
      fork,
      USDC_MAINNET,
      permitCalldata as `0x${string}`,
    );

    console.log(`[fork/D1] permit() tx status: ${permitStatus}`);
    expect(permitStatus).toBe("success");

    // Verify allowance was set
    const allowanceAfter = await readErc20Allowance(fork, USDC_MAINNET, TEST_ADDRESS, SETTLEMENT_CONTRACT);
    console.log(
      `[fork/D1] USDC allowance for the FX provider after permit: ${allowanceAfter} (expected ${PERMIT_VALUE})`,
    );
    expect(allowanceAfter).toBe(PERMIT_VALUE);
  });
});

// ─── TEST E: Polymarket USDC.e approve on Polygon fork ───────────────────────

describe("E: Polymarket USDC.e approve on Polygon fork", () => {
  it("E1: approve USDC.e to CTF Exchange on Polygon — allowance set", async () => {
    if (skipAll) {
      console.warn(`[fork/E1] SKIP: ${skipReason}`);
      return;
    }
    const fork = polyFork!;

    // Confirm test account has USDC.e balance
    const balance = await readErc20Balance(fork, USDC_E_POLYGON as `0x${string}`, TEST_ADDRESS);
    expect(balance).toBeGreaterThanOrEqual(USDC_E_FUND_RAW);
    console.log(
      `[fork/E1] USDC.e balance on Polygon: ${balance} (${Number(balance) / 1e6} USDC.e)`,
    );

    // Initial allowance should be 0 for our test account
    const allowanceBefore = await readErc20Allowance(
      fork,
      USDC_E_POLYGON as `0x${string}`,
      TEST_ADDRESS,
      CTF_EXCHANGE_POLYGON,
    );
    console.log(`[fork/E1] CTF Exchange allowance before: ${allowanceBefore}`);

    // Approve exact cost (5 USDC.e = cost of a $5 bet)
    const betCostRaw = 5_000_000n; // 5 USDC.e
    const approveData = encodeApprove(CTF_EXCHANGE_POLYGON as `0x${string}`, betCostRaw);
    const { status } = await sendAndWait(fork, USDC_E_POLYGON as `0x${string}`, approveData);
    expect(status).toBe("success");
    console.log("[fork/E1] approve: success");

    const allowanceAfter = await readErc20Allowance(
      fork,
      USDC_E_POLYGON as `0x${string}`,
      TEST_ADDRESS,
      CTF_EXCHANGE_POLYGON,
    );
    console.log(
      `[fork/E1] CTF Exchange allowance after: ${allowanceAfter} (expected ${betCostRaw})`,
    );
    expect(allowanceAfter).toBe(betCostRaw);
  });

  it("E2: CTF Exchange address has deployed bytecode (not EOA / wrong address)", async () => {
    if (skipAll) {
      console.warn(`[fork/E2] SKIP: ${skipReason}`);
      return;
    }
    const fork = polyFork!;

    const code = await getCode(fork, CTF_EXCHANGE_POLYGON as `0x${string}`);
    const hasCode = code !== "0x" && code.length > 2;
    console.log(
      `[fork/E2] CTF Exchange ${CTF_EXCHANGE_POLYGON}: bytecode ${hasCode ? `present (${code.length / 2 - 1} bytes)` : "EMPTY — wrong address!"}`,
    );
    expect(hasCode).toBe(true);
  });
});
