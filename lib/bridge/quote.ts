/**
 * lib/bridge/quote.ts
 *
 * LiFi cross-chain bridge quote builder for Ethereum → Polygon USDC.e.
 *
 * Key facts confirmed by live API testing (2026-06-12):
 *
 * Route:
 *   fromChain=1 (Ethereum), toChain=137 (Polygon)
 *   toToken=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 (USDC.e on Polygon)
 *   Default best route: Polygon Bridge (PoS), executionDuration≈1178s (~20min)
 *   transactionRequest.chainId=1 — user signs ONE tx on Ethereum only.
 *
 * Approval:
 *   estimate.approvalAddress=0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE (LiFi diamond)
 *   User approves the fromToken on Ethereum before submitting transactionRequest.
 *
 * fromAmountForGas:
 *   Confirmed DOES NOT WORK for this corridor. Adding it to the query causes
 *   "No available quotes" (code 1002) on both Polygon PoS and Across routes.
 *   The feature requires bridge-level destination-call support, which these
 *   bridges do not expose. Design decision: omit the param; surface a
 *   gasDropNote in the response so the UI can prompt the user separately.
 *
 * Gas estimate:
 *   gasCosts[0].amountUSD from the LiFi response gives the Ethereum-side gas.
 *   At current gwei levels this is ~$0.11–0.21 for the bridge tx.
 */

import {
  ETH_USDC as _ETH_USDC,
  ETH_USDT as _ETH_USDT,
  POLYGON_USDCE as _POLYGON_USDCE,
} from "@/lib/chains/tokens";
import type { BridgeQuoteRequest, BridgeQuoteResponse } from "./types";

/** Polygon USDC.e (bridged USDC) — the only accepted destination token. */
export const POLYGON_USDCE = _POLYGON_USDCE;

/** USDC on Ethereum mainnet (canonical). */
export const ETH_USDC = _ETH_USDC;

/** USDT on Ethereum mainnet (canonical). */
export const ETH_USDT = _ETH_USDT;

const LIFI_QUOTE = "https://li.quest/v1/quote";
const LIFI_TIMEOUT_MS = 10_000;

/**
 * These are the Ethereum stablecoins we'll accept as bridge inputs.
 * Checksummed addresses — LiFi is case-insensitive but we normalise here.
 */
export const BRIDGE_SOURCE_TOKENS = new Set([ETH_USDC.toLowerCase(), ETH_USDT.toLowerCase()]);

/** Human-readable label for supported source tokens. */
export function bridgeSourceLabel(address: string): string {
  const a = address.toLowerCase();
  if (a === ETH_USDC.toLowerCase()) return "USDC";
  if (a === ETH_USDT.toLowerCase()) return "USDT";
  return `${address.slice(0, 8)}…`;
}

// ─── Internal response shape (LiFi /v1/quote) ────────────────────────────────

interface LifiGasCost {
  type: string;
  amountUSD?: string;
  token?: { symbol?: string };
}

interface LifiEstimate {
  approvalAddress?: string;
  toAmountMin?: string;
  toAmount?: string;
  fromAmount?: string;
  executionDuration?: number;
  gasCosts?: LifiGasCost[];
}

interface LifiTxRequest {
  to?: string;
  data?: string;
  value?: string;
  chainId?: number;
  gasLimit?: string;
}

interface LifiQuoteRaw {
  tool?: string;
  toolDetails?: { name?: string };
  estimate?: LifiEstimate;
  transactionRequest?: LifiTxRequest;
  message?: string;
  code?: number;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build LiFi query params for the bridge quote.
 *
 * NOTE: fromAmountForGas is intentionally omitted (see module docblock).
 */
export function buildBridgeQuoteParams(
  req: Pick<BridgeQuoteRequest, "fromToken" | "fromAmountRaw" | "owner">,
  integrator: string,
): URLSearchParams {
  return new URLSearchParams({
    fromChain: "1",
    toChain: "137",
    fromToken: req.fromToken,
    toToken: POLYGON_USDCE,
    fromAmount: req.fromAmountRaw,
    fromAddress: req.owner,
    toAddress: req.owner,
    integrator,
    slippage: "0.005",
  });
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export type BridgeQuoteFetchResult =
  | { ok: true; data: BridgeQuoteResponse }
  | { ok: false; message: string };

export async function fetchBridgeQuote(
  req: BridgeQuoteRequest,
  integrator: string,
  apiKey?: string,
): Promise<BridgeQuoteFetchResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIFI_TIMEOUT_MS);

  try {
    const qs = buildBridgeQuoteParams(req, integrator);
    const headers: Record<string, string> = {};
    if (apiKey) headers["x-lifi-api-key"] = apiKey;

    const res = await fetch(`${LIFI_QUOTE}?${qs}`, {
      signal: ctrl.signal,
      cache: "no-store",
      headers,
    });

    const raw: LifiQuoteRaw = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = raw.message ?? `LiFi ${res.status}`;
      return { ok: false, message: msg };
    }

    const e = raw.estimate;
    const tx = raw.transactionRequest;

    if (!e?.toAmountMin || !e?.approvalAddress || !tx?.to || !tx?.data) {
      return { ok: false, message: "LiFi returned incomplete quote" };
    }

    if (tx.chainId !== 1) {
      // Sanity: the tx must be on Ethereum, not Polygon
      return {
        ok: false,
        message: `Unexpected bridge tx chain: ${tx.chainId}`,
      };
    }

    const gasUsd = e.gasCosts?.[0]?.amountUSD ? Number(e.gasCosts[0].amountUSD) : 0;
    const executionSeconds = e.executionDuration ?? 1200;
    const toolName = raw.toolDetails?.name ?? raw.tool ?? "LiFi Bridge";

    const gasDropNote = req.gasOnDestination
      ? "You'll need ~0.1 POL on Polygon for gas. Get POL at quickswap.exchange or gas.zip before approving USDC.e."
      : undefined;

    return {
      ok: true,
      data: {
        toAmountMin: e.toAmountMin,
        approvalAddress: e.approvalAddress,
        transactionRequest: {
          to: tx.to,
          data: tx.data,
          value: tx.value ?? "0x0",
          chainId: tx.chainId,
          gasLimit: tx.gasLimit,
        },
        executionSeconds,
        gasUsd,
        tool: toolName,
        gasDropNote,
      },
    };
  } catch (err) {
    const aborted = (err as Error).name === "AbortError";
    return {
      ok: false,
      message: aborted ? "LiFi bridge quote timed out" : `LiFi error: ${(err as Error).message}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
