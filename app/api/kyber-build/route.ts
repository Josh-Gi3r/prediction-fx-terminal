import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress } from "@/lib/api/validate";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// KyberSwap route/build — turns a routeSummary (from /routes) into encoded swap
// calldata + router address. Keyless (X-Client-Id only). Verified live 2026-05-31:
// router 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5, returns calldata.
const KYBER_BUILD = "https://aggregator-api.kyberswap.com/ethereum/api/v1/route/build";
const TIMEOUT_MS = 8000;

const KyberBuildSchema = z.object({
  routeSummary: z.unknown().refine((v) => v !== null && v !== undefined, {
    message: "routeSummary is required",
  }),
  sender: zAddress,
  recipient: zAddress,
  slippageBps: z.number().int().min(0).max(10_000).optional(),
});

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { name: "kyber-build", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, KyberBuildSchema, { tag: "kyber-build" });
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(KYBER_BUILD, {
      method: "POST",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "content-type": "application/json", "X-Client-Id": "predfx-terminal" },
      body: JSON.stringify({
        routeSummary: b.routeSummary,
        sender: b.sender,
        recipient: b.recipient,
        slippageTolerance: b.slippageBps ?? 50,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || (data as { code?: number }).code !== 0) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? `Kyber build ${res.status}` },
        { status: 200 },
      );
    }
    const d =
      (data as { data?: { routerAddress?: string; data?: string; amountOut?: string } }).data ?? {};
    return NextResponse.json({
      routerAddress: d.routerAddress,
      data: d.data, // encoded swap calldata
      amountOut: d.amountOut,
    });
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json(
      { error: aborted ? "Kyber build timed out" : `Kyber build failed: ${(e as Error).message}` },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
