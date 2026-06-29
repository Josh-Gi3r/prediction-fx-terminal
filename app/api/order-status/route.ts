import { apiError } from "@/lib/api/apiError";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseQuery } from "@/lib/api/validate";
import { FxApiError, fxClient } from "@/lib/fx-provider/server-client";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/order-status?trade_id=<id>
//
// Polls GET /orders/{trade_id} on the FX provider and returns a normalised status envelope.
// Terminal statuses: "settled" | "failed" | "cancelled".
// Pending statuses: "pending" | "matched" (still in-flight, keep polling).
//
// ⚠️  NEVER trigger a re-submit based on a non-terminal status — late settlement
//     on the FX provider = double-execution risk. The caller is responsible for honouring this.

// trade_id is a UUID4 from the FX provider; allow any alphanumeric + hyphens, 8–64 chars.
const OrderStatusSchema = z.object({
  trade_id: z.string().regex(/^[a-zA-Z0-9_\-]{8,64}$/, "invalid trade_id"),
});

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { name: "order-status", limit: 120, windowMs: 60_000 });
  if (limited) return limited;

  const qResult = parseQuery(req, OrderStatusSchema, { tag: "order-status" });
  if (!qResult.ok) return qResult.res;
  const { trade_id: tradeId } = qResult.data;

  try {
    const order = await fxClient.getOrder(tradeId);

    // Derive a single terminal/pending signal from both the top-level status
    // and settlement_summary (statuses lie at the top level on mainnet).
    const topStatus = order.status ?? "pending";
    const settleSummary = order.settlement_summary;
    const settleStatus = settleSummary?.status ?? "pending";

    // Terminal: settled means at least one fill settled successfully.
    const isSettled =
      topStatus === "settled" ||
      settleStatus === "settled" ||
      (settleSummary?.settled_fill_count != null && settleSummary.settled_fill_count > 0);

    // Terminal: hard failure (no fills, error or revert).
    const isFailed =
      topStatus === "failed" ||
      topStatus === "cancelled" ||
      settleStatus === "failed" ||
      (topStatus !== "settled" &&
        settleStatus !== "settled" &&
        (order.error_code != null ||
          (settleSummary?.failed_fill_count != null &&
            settleSummary.failed_fill_count > 0 &&
            (settleSummary.settled_fill_count ?? 0) === 0)));

    const terminal = isSettled || isFailed;

    return NextResponse.json({
      terminal,
      settled: isSettled,
      failed: isFailed,
      status: topStatus,
      settle_status: settleStatus,
      tx_hash: settleSummary?.latest_tx_hash ?? null,
      filled_amount: order.filled_amount ?? null,
      to_amount: order.to_amount ?? null,
      error: order.error ?? null,
      error_code: order.error_code ?? null,
    });
  } catch (e) {
    const status = e instanceof FxApiError ? e.status : 500;
    // 404 = trade_id not yet indexed; treat as still pending (not an error).
    if (status === 404) {
      return NextResponse.json({
        terminal: false,
        settled: false,
        failed: false,
        status: "pending",
      });
    }
    console.error("[order-status] FX provider upstream error:", (e as Error).message);
    return apiError("upstream_error", status);
  }
}
