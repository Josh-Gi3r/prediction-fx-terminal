import { rateLimit } from "@/lib/api/rateLimit";
import { parseJsonBody, zAddress, zRawAmount } from "@/lib/api/validate";
import { getFxProviderBaseUrl } from "@/lib/fx-provider/config";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Builds a settlement vault DEPOSIT tx envelope. The FX provider's /deposit builder is API-key-gated
// (the key only BUILDS calldata — the user signs+broadcasts with their own wallet,
// so funds stay non-custodial). If no key is configured, returns {needsKey:true} and
// the UI falls back to a "fund on your-fx-provider.example.com" link.
//
// To activate: provision an FX provider API key (self-serve via the wallet
// ManageApiKey EIP-712 flow) and set FX_PROVIDER_API_KEY + FX_PROVIDER_API_SECRET in .env.local.
// The key is READ/BUILD-scoped — it cannot move funds.
const TIMEOUT_MS = 10_000;

const FxDepositSchema = z.object({
  token: zAddress,
  owner: zAddress,
  amount: zRawAmount,
});

export async function POST(req: NextRequest) {
  const key = process.env.FX_PROVIDER_API_KEY;
  const secret = process.env.FX_PROVIDER_API_SECRET;
  if (!key || !secret) {
    return NextResponse.json({
      needsKey: true,
      fundUrl: "https://your-fx-provider.example.com",
      message:
        "Set FX_PROVIDER_API_KEY + FX_PROVIDER_API_SECRET in .env.local to enable in-app deposit, or fund on your-fx-provider.example.com.",
    });
  }

  const limited = rateLimit(req, { name: "fx-deposit", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  const parsed = await parseJsonBody(req, FxDepositSchema, { tag: "fx-deposit" });
  if (!parsed.ok) return parsed.res;
  const b = parsed.data;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${getFxProviderBaseUrl()}/deposit`, {
      method: "POST",
      signal: ctrl.signal,
      cache: "no-store",
      headers: { "content-type": "application/json", Authorization: `Bearer ${key}:${secret}` },
      body: JSON.stringify({ token: b.token, owner: b.owner, amount: b.amount }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 400 "Invalid request" here usually means allowance not yet on-chain — the UI
      // sends the ERC20 approve first and waits for the receipt before calling this.
      return NextResponse.json(
        { error: (data as { detail?: string }).detail ?? `FX provider deposit ${res.status}` },
        { status: 200 },
      );
    }
    // Expect a tx envelope { to, data, value, chain_id }.
    return NextResponse.json(data);
  } catch (e) {
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json(
      {
        error: aborted ? "FX provider deposit timed out" : `FX provider deposit failed: ${(e as Error).message}`,
      },
      { status: 200 },
    );
  } finally {
    clearTimeout(timer);
  }
}
