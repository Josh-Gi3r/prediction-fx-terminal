// Server-side FX Provider REST client. Runs in Next.js route handlers (never the browser
// — dodges CORS, centralizes timeouts). Every fetch is AbortController-bounded:
// Node's undici fetch has NO default timeout, so one hung connection would stall
// forever (the freeze that burned the fx-provider-dashboard session).
import "server-only";
import { getFxProviderBaseUrl } from "./config";
import type {
  BalancesResponse,
  FxConfig,
  FxToken,
  SwapExecuteRequest,
  SwapExecuteResponse,
  SwapQuoteRequest,
  SwapQuoteResponse,
} from "./core/types";

const BASE = getFxProviderBaseUrl();
const TIMEOUT_MS = 8000;

export class FxApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "FxApiError";
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "user-agent": "predfx-terminal/0.1",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      // FX provider business errors arrive as 400 {detail:{success:false,error:"no_liquidity"}}
      // or 422 {detail:"Invalid request"} (malformed). Surface both.
      const detail =
        (parsed as { detail?: unknown })?.detail ?? (parsed as { message?: string })?.message;
      throw new FxApiError(
        res.status,
        typeof detail === "string" ? detail : JSON.stringify(detail ?? parsed),
        parsed,
      );
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof FxApiError) throw err;
    if ((err as Error).name === "AbortError")
      throw new FxApiError(504, `FX provider request timed out after ${TIMEOUT_MS}ms: ${path}`);
    throw new FxApiError(502, `FX provider request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

// Auth-enabled variant: attaches FX_PROVIDER_API_KEY / FX_PROVIDER_API_SECRET when available.
// Used for order-status polling which may require auth on the /orders/{id} endpoint.
async function callAuth<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.FX_PROVIDER_API_KEY;
  const secret = process.env.FX_PROVIDER_API_SECRET;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "predfx-terminal/0.1",
    };
    if (key && secret) {
      headers.authorization = `Bearer ${key}:${secret}`;
    }
    const res = await fetch(`${BASE}${path}`, {
      method,
      signal: ctrl.signal,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (!res.ok) {
      const detail =
        (parsed as { detail?: unknown })?.detail ?? (parsed as { message?: string })?.message;
      throw new FxApiError(
        res.status,
        typeof detail === "string" ? detail : JSON.stringify(detail ?? parsed),
        parsed,
      );
    }
    return parsed as T;
  } catch (err) {
    if (err instanceof FxApiError) throw err;
    if ((err as Error).name === "AbortError")
      throw new FxApiError(504, `FX provider request timed out after ${TIMEOUT_MS}ms: ${path}`);
    throw new FxApiError(502, `FX provider request failed: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Minimal shape returned by GET /orders/{id} — we only care about settlement. */
export interface FxOrderStatus {
  status: "pending" | "matched" | "settled" | "cancelled" | "failed" | string;
  settlement_summary?: {
    status: "pending" | "settled" | "failed" | string;
    settled_fill_count?: number;
    failed_fill_count?: number;
    reverted_fill_count?: number;
    latest_tx_hash?: string | null;
  };
  to_amount?: string;
  filled_amount?: string;
  error?: string | null;
  error_code?: string | null;
}

export const fxClient = {
  getConfig: () => call<FxConfig>("GET", "/config"),
  getTokens: () => call<{ tokens: FxToken[] }>("GET", "/tokens"),
  getMarkets: () => call<{ markets: Array<Record<string, unknown>> }>("GET", "/markets"),
  getSystemTime: () => call<{ timestamp: number }>("GET", "/system/time"),
  getBalances: (owner: string) => call<BalancesResponse>("GET", `/balances?owner_address=${owner}`),
  postSwapQuote: (req: SwapQuoteRequest) => call<SwapQuoteResponse>("POST", "/swap/quote", req),
  postSwap: (req: SwapExecuteRequest) => call<SwapExecuteResponse>("POST", "/swap", req),
  postSwapQuoteBatch: (quotes: SwapQuoteRequest[]) =>
    call<{ items: Array<{ ok: true; quote: SwapQuoteResponse } | { ok: false; error: string }> }>(
      "POST",
      "/swap/quote/batch",
      { quotes },
    ),
  postVlBatch: (orders: unknown[]) =>
    call<{ vl_batch_id: string; placed: unknown[] }>("POST", "/orders/vl/batch", { orders }),
  postVlCancel: (body: { owner_address: string; vl_batch_id: string; signature: string }) =>
    call<{ canceled: boolean }>("POST", "/orders/vl/cancel", body),
  postApprove: (body: { token: string; owner: string; spender: string; amount: string }) =>
    call<{ to: string; data: string; value: string; chain_id: number }>("POST", "/approve", body),
  postDeposit: (body: { token: string; owner: string; amount: string }) =>
    call<{ to: string; data: string; value: string; chain_id: number }>("POST", "/deposit", body),
  /** Poll order settlement status. Uses API key auth when env vars are set. */
  getOrder: (tradeId: string) => callAuth<FxOrderStatus>("GET", `/orders/${tradeId}`),
};
