import { getFxProviderBaseUrl } from "./config";
import type {
  Address,
  BalancesResponse,
  ConfigResponse,
  FxRateResponse,
  HealthResponse,
  ListOrdersResponse,
  MarketsResponse,
  Order,
  PlaceOrderRequest,
  PlaceOrderResponse,
  SwapQuoteRequest,
  SwapQuoteResponse,
  SwapSubmitRequest,
  SwapSubmitResponse,
  SystemTimeResponse,
  TokensResponse,
} from "./types";
import { FxApiError } from "./types";

interface ClientOptions {
  baseUrl?: string;
  apiKey?: string;
  apiSecret?: string;
  fetch?: typeof fetch;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  authRequired?: boolean;
}

/**
 * Typed FX Provider REST client.
 *
 * - Public endpoints work without credentials.
 * - Authenticated read endpoints take API key + secret.
 * - Trading mutations take EIP-712 signed payloads constructed elsewhere
 *   (see lib/eip712).
 *
 * All errors throw `FxApiError` with structured `code` when the server
 * returns a typed envelope. Branch on `code`, not the message.
 */
export class FxProviderClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? getFxProviderBaseUrl()).replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.apiSecret = opts.apiSecret;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = {};
    if (opts.body !== undefined) headers["content-type"] = "application/json";

    if (opts.authRequired) {
      if (!this.apiKey || !this.apiSecret) {
        throw new FxApiError(401, null, "Missing API key for authenticated request", null);
      }
      headers.authorization = `Bearer ${this.apiKey}:${this.apiSecret}`;
    }

    const res = await this.fetchImpl(url.toString(), {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });

    const text = await res.text();
    const parsed = text.length > 0 ? safeJsonParse(text) : null;

    if (!res.ok) {
      const { code, message } = extractError(parsed, res.status);
      throw new FxApiError(res.status, code, message, parsed);
    }

    return parsed as T;
  }

  // ============ System ============

  health(signal?: AbortSignal) {
    return this.request<HealthResponse>("/health", { signal });
  }

  systemTime(signal?: AbortSignal) {
    return this.request<SystemTimeResponse>("/system/time", { signal });
  }

  tokens(signal?: AbortSignal) {
    return this.request<TokensResponse>("/tokens", { signal });
  }

  markets(signal?: AbortSignal) {
    return this.request<MarketsResponse>("/markets", { signal });
  }

  fxRate(base: string, quote: string, signal?: AbortSignal) {
    return this.request<FxRateResponse>("/fx/rate", {
      query: { base, quote },
      signal,
    });
  }

  config(signal?: AbortSignal) {
    return this.request<ConfigResponse>("/config", { signal });
  }

  // ============ Account ============

  balances(ownerAddress: Address, includeZero = false, signal?: AbortSignal) {
    return this.request<BalancesResponse>("/balances", {
      query: { owner_address: ownerAddress, include_zero: includeZero },
      authRequired: true,
      signal,
    });
  }

  // ============ Swaps ============

  swapQuote(req: SwapQuoteRequest, signal?: AbortSignal) {
    return this.request<SwapQuoteResponse>("/swap/quote", {
      method: "POST",
      body: req,
      signal,
    });
  }

  swapSubmit(req: SwapSubmitRequest, signal?: AbortSignal) {
    return this.request<SwapSubmitResponse>("/swap", {
      method: "POST",
      body: req,
      signal,
    });
  }

  // ============ Orders ============

  placeOrder(req: PlaceOrderRequest, signal?: AbortSignal) {
    return this.request<PlaceOrderResponse>("/orders", {
      method: "POST",
      body: req,
      signal,
    });
  }

  getOrder(orderId: string, signal?: AbortSignal) {
    return this.request<Order>(`/orders/${orderId}`, {
      authRequired: true,
      signal,
    });
  }

  listOrders(
    ownerAddress: Address,
    opts: { limit?: number; offset?: number; status?: string } = {},
    signal?: AbortSignal,
  ) {
    return this.request<ListOrdersResponse>("/orders", {
      query: { owner_address: ownerAddress, ...opts },
      authRequired: true,
      signal,
    });
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractError(parsed: unknown, status: number): { code: string | null; message: string } {
  if (parsed && typeof parsed === "object" && "detail" in parsed) {
    const detail = (parsed as { detail: unknown }).detail;
    if (typeof detail === "string") return { code: null, message: detail };
    if (detail && typeof detail === "object") {
      const d = detail as { detail?: string; error_code?: string };
      return {
        code: d.error_code ?? null,
        message: d.detail ?? `FX Provider API error ${status}`,
      };
    }
  }
  return { code: null, message: `FX Provider API error ${status}` };
}

/** Singleton for the public read paths, used in server components. */
export const fxClient = new FxProviderClient();
