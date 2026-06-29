import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress, zDecimals, zRawAmount } from "@/lib/api/validate";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
// Full rate scan: given a FROM token, quotes EVERY target token on both the FX provider
// (batched 50/call via /swap/quote/batch) and KyberSwap (parallel, chunked) —
// returns the comparison matrix so the UI can render the full rate landscape.
//
// KyberSwap replaced Paraswap/Velora here (2026-05-31): Velora now 429s on every
// keyless call. Kyber is keyless (X-Client-Id header only) and survives bulk
// fanout (verified: 12 rapid calls, zero 429s). LiFi stays OUT of the bulk scan
// (rate-limits hard); it's only in the single-pair /api/quote (useQuotes).
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BURN = "0x000000000000000000000000000000000000dEaD";
const KYBER = "https://aggregator-api.kyberswap.com/ethereum/api/v1/routes";
const FX_BATCH = 50; // /swap/quote/batch hard cap
const KYBER_CONCURRENCY = 6; // gentle on the public endpoint
const KYBER_HAIRCUT_BPS = 50n; // 0.5% slippage so it compares like-for-like to FX provider min-out

const ScanTargetSchema = z.object({
  address: zAddress,
  symbol: z.string().min(1).max(16),
  decimals: zDecimals,
  sources: z.array(z.enum(["fx-provider", "lifi"])).optional(),
});

const ScanBodySchema = z.object({
  from_token: zAddress,
  from_decimals: zDecimals.optional().default(18),
  from_amount: zRawAmount,
  targets: z.array(ScanTargetSchema).max(80, "max 80 targets per scan"),
});

type ScanBody = z.infer<typeof ScanBodySchema>;

interface RowResult {
  symbol: string;
  address: string;
  decimals: number;
  fxProvider: { ok: true; outRaw: string; rate: number } | { ok: false } | null;
  kyber: { ok: true; outRaw: string; rate: number; tool: string } | { ok: false } | null;
  bestSource: "fx-provider" | "kyber" | null;
}

function rateFromRaw(outRaw: string, outDec: number, inRaw: string, inDec: number) {
  const out = Number(BigInt(outRaw)) / 10 ** outDec;
  const inp = Number(BigInt(inRaw)) / 10 ** inDec;
  return inp > 0 ? out / inp : 0;
}

async function scanFxProvider(body: ScanBody): Promise<Record<string, RowResult["fxProvider"]>> {
  const result: Record<string, RowResult["fxProvider"]> = {};
  // Anchor expiration to server clock; fallback to local.
  let now: number;
  try {
    now = Number((await fxClient.getSystemTime()).timestamp);
  } catch {
    now = Math.floor(Date.now() / 1000);
  }
  const expiration = now + 600;

  // Chunk into batches of 50.
  for (let i = 0; i < body.targets.length; i += FX_BATCH) {
    const chunk = body.targets.slice(i, i + FX_BATCH);
    const quotes = chunk.map((t) => ({
      from_token: body.from_token,
      to_token: t.address,
      from_amount: body.from_amount,
      owner_address: BURN,
      recipient: BURN,
      expiration,
      gas_mode: "receive_less" as const,
    }));
    try {
      const res = await fxClient.postSwapQuoteBatch(quotes);
      res.items.forEach((item, j) => {
        const tgt = chunk[j];
        if (!tgt) return;
        if (item.ok && item.quote?.route_params?.minOutputAmount) {
          const outRaw = item.quote.route_params.minOutputAmount;
          result[tgt.address.toLowerCase()] = {
            ok: true,
            outRaw,
            rate: rateFromRaw(outRaw, tgt.decimals, body.from_amount, body.from_decimals),
          };
        } else {
          result[tgt.address.toLowerCase()] = { ok: false };
        }
      });
    } catch {
      // Whole chunk failed — mark all as no_liquidity-ish so the UI shows "—".
      for (const tgt of chunk) result[tgt.address.toLowerCase()] = { ok: false };
    }
  }
  return result;
}

async function kyberOne(
  body: ScanBody,
  target: z.infer<typeof ScanTargetSchema>,
): Promise<RowResult["kyber"]> {
  const qs = new URLSearchParams({
    tokenIn: body.from_token,
    tokenOut: target.address,
    amountIn: body.from_amount,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(`${KYBER}?${qs}`, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "X-Client-Id": "predfx-terminal" },
    });
    if (!r.ok) return { ok: false };
    const d = (await r.json()) as {
      data?: {
        routeSummary?: {
          amountOut?: string;
          route?: Array<Array<{ poolType?: string; exchange?: string }>>;
        };
      };
    };
    const out = d.data?.routeSummary?.amountOut;
    if (!out) return { ok: false };
    // Match The FX provider's min-out reporting: -50 bps slippage haircut on the expected out.
    const haircut = ((BigInt(out) * (10_000n - KYBER_HAIRCUT_BPS)) / 10_000n).toString();
    const hop = d.data?.routeSummary?.route?.[0]?.[0];
    const tool = hop?.exchange ?? hop?.poolType ?? "KyberSwap";
    return {
      ok: true,
      outRaw: haircut,
      rate: rateFromRaw(haircut, target.decimals, body.from_amount, body.from_decimals),
      tool,
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function scanKyber(body: ScanBody): Promise<Record<string, RowResult["kyber"]>> {
  const out: Record<string, RowResult["kyber"]> = {};
  for (let i = 0; i < body.targets.length; i += KYBER_CONCURRENCY) {
    const chunk = body.targets.slice(i, i + KYBER_CONCURRENCY);
    const res = await Promise.all(chunk.map((t) => kyberOne(body, t)));
    res.forEach((r, j) => {
      const t = chunk[j];
      if (t) out[t.address.toLowerCase()] = r;
    });
  }
  return out;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "scan", limit: 6, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, ScanBodySchema, { tag: "scan" });
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  try {
    const [fxProviderMap, kyberMap] = await Promise.all([scanFxProvider(body), scanKyber(body)]);

    const rows: RowResult[] = body.targets.map((t) => {
      const k = t.address.toLowerCase();
      const fxProviderRow = fxProviderMap[k] ?? null;
      const kyber = kyberMap[k] ?? null;
      let best: "fx-provider" | "kyber" | null = null;
      const fxProviderOk = fxProviderRow && "ok" in fxProviderRow && fxProviderRow.ok;
      const kyberOk = kyber && "ok" in kyber && kyber.ok;
      if (fxProviderOk && kyberOk) {
        best =
          BigInt((fxProviderRow as { outRaw: string }).outRaw) >=
          BigInt((kyber as { outRaw: string }).outRaw)
            ? "fx-provider"
            : "kyber";
      } else if (fxProviderOk) best = "fx-provider";
      else if (kyberOk) best = "kyber";
      return {
        symbol: t.symbol,
        address: k,
        decimals: t.decimals,
        fxProvider: fxProviderRow,
        kyber,
        bestSource: best,
      };
    });

    return NextResponse.json({ rows });
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    console.error("[scan] upstream error:", (e as Error).message);
    return apiError("scan_failed", status);
  }
}
