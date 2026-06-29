"use client";

/**
 * useBet -- place a Polymarket bet from the prediction market surface.
 *
 * Flow:
 * 1. POST /api/pm/order -- server validates market, returns tokenId/tickSize/negRisk.
 * 2. Allowance gate -- useUsdcApproval checks on-chain; caller renders
 *    Approve button if needsApproval is true (see BetSheet/BetSlip).
 * 3. switchChain(137) + makeUserClobClient.
 * 4. client.createOrder({tokenID, price, size, side: BUY, feeRateBps:0},
 *    {tickSize, negRisk}) -- SDK signs with user's wallet.
 * 5. client.postOrder(signed, FOK) -- client submits directly to CLOB.
 * 6. Map response status: matched->"filled", live->"open", delayed->"pending",
 *    unmatched/success:false->"error".
 * 7. If status is "open": poll getOrder 2s x 20 max; timeout->"unconfirmed".
 *
 * Security: user's L2 creds never leave the browser. Builder attribution
 * happens via the remote-sign route (/api/pm/builder-sign) which holds
 * the HMAC secret server-side. The browser-side builder proxy (makeRemoteBuilderProxy)
 * calls that route to obtain POLY_BUILDER_* headers without node:crypto.
 *
 * Only FOK is supported at launch. GTC code paths are kept clean but the
 * UI does not expose the toggle.
 */

import { OrderType, Side } from "@polymarket/clob-client";
import type { TickSize } from "@polymarket/clob-client";
import { useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { createWalletClient, custom } from "viem";
import { polygon } from "wagmi/chains";
import { makeUserClobClient } from "./order";
import type { PmCreds } from "./useDeriveCreds";

export type BetSide = "yes" | "no";

export interface PlaceBetArgs {
  /** App-internal market key (e.g. "wc:champion:...") */
  marketKey: string;
  side: BetSide;
  /** Limit price 0-1. For FOK: worst-case price. Must conform to tick size. */
  price: number;
  /** Shares to buy (>= market minOrderSize). */
  size: number;
  creds: PmCreds;
}

export type BetStatus =
  | "idle"
  | "building"
  | "checking-allowance"
  | "approving"
  | "signing"
  | "submitting"
  | "polling"
  | "filled"
  | "open"
  | "pending"
  | "unconfirmed"
  | "cancelled"
  | "error";

export interface BetState {
  status: BetStatus;
  orderId: string | null;
  error: string | null;
}

export interface UseBet {
  bet: BetState;
  placeBet: (args: PlaceBetArgs) => Promise<void>;
  reset: () => void;
}

const IDLE: BetState = { status: "idle", orderId: null, error: null };
const POLL_INTERVAL_MS = 2_000;
const POLL_MAX_ATTEMPTS = 20;

/**
 * Valid tick sizes per the Polymarket SDK ROUNDING_CONFIG.
 * A value outside this set will cause the SDK to throw or silently
 * miscalculate order amounts.
 */
const VALID_TICK_SIZES = new Set(["0.1", "0.01", "0.001", "0.0001"]);

/**
 * Validate tickSize before passing it to the SDK.
 * Throws a clear error if the registry returns a bad value.
 */
export function validateTickSize(raw: string): TickSize {
  if (!VALID_TICK_SIZES.has(raw)) {
    throw new Error(
      `Invalid tickSize "${raw}" from registry. Expected one of: ${[...VALID_TICK_SIZES].join(", ")}`,
    );
  }
  return raw as TickSize;
}

/** Map CLOB geo-block errors to a user-facing message. */
function mapClobError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("geo") ||
    lower.includes("region") ||
    lower.includes("country") ||
    lower.includes("restricted")
  ) {
    return "Polymarket is unavailable in your region.";
  }
  return "Order could not be placed. Please try again.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useBet(): UseBet {
  const { wallets } = useWallets();
  const [bet, setBet] = useState<BetState>(IDLE);

  const reset = useCallback(() => setBet(IDLE), []);

  const placeBet = useCallback(
    async (args: PlaceBetArgs) => {
      const wallet = wallets[0];
      if (!wallet) {
        setBet({ status: "error", orderId: null, error: "Wallet not connected" });
        return;
      }

      try {
        // 1. Resolve market params from server
        setBet({ status: "building", orderId: null, error: null });

        const orderRes = await fetch("/api/pm/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ marketKey: args.marketKey, side: args.side }),
        });

        if (!orderRes.ok) {
          const err = await orderRes.json().catch(() => ({ error: orderRes.statusText }));
          throw new Error((err as { error?: string }).error ?? `order params ${orderRes.status}`);
        }

        const {
          tokenId,
          tickSize: tickSizeRaw,
          negRisk,
        } = (await orderRes.json()) as {
          tokenId: string;
          tickSize: string;
          negRisk: boolean;
          minOrderSize: number;
        };

        // Validate tickSize before passing to SDK -- bad value breaks ROUNDING_CONFIG.
        const tickSize = validateTickSize(tickSizeRaw);

        // 2. Build client + sign order
        setBet({ status: "signing", orderId: null, error: null });

        await wallet.switchChain(polygon.id);
        const provider = await wallet.getEthereumProvider();
        const account = wallet.address as `0x${string}`;
        const walletClient = createWalletClient({
          chain: polygon,
          transport: custom(provider),
          account,
        });

        const origin =
          typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://your-app.example.com");

        const client = makeUserClobClient(walletClient, args.creds, origin);

        // createOrder signs with the user's wallet via the SDK
        const signedOrder = await client.createOrder(
          {
            tokenID: tokenId,
            price: args.price,
            size: args.size,
            side: Side.BUY,
            feeRateBps: 0,
            // expiration "0" = no expiration; FOK is set at postOrder level
          },
          {
            tickSize,
            negRisk,
          },
        );

        // 3. Submit directly to CLOB
        setBet({ status: "submitting", orderId: null, error: null });

        const postResult = await client.postOrder(signedOrder, OrderType.FOK);

        // postResult: { success, errorMsg, orderID, status, ... }
        // Require explicit success===true AND a non-empty orderID.
        // An error envelope ({}) or missing fields must NOT be treated as success.
        const rawStatus: string = (postResult as { status?: string }).status ?? "";
        const explicitSuccess: boolean = (postResult as { success?: boolean }).success === true;
        const orderId: string = (postResult as { orderID?: string }).orderID ?? "";

        if (!explicitSuccess || !orderId || rawStatus.toLowerCase() === "unmatched") {
          console.warn("[useBet] CLOB rejection:", postResult);
          const rawMsg: string =
            (postResult as { errorMsg?: string }).errorMsg ??
            (!explicitSuccess ? "CLOB did not confirm order" : "unmatched");
          setBet({ status: "error", orderId: null, error: mapClobError(rawMsg) });
          return;
        }

        const normalizedStatus = rawStatus.toLowerCase();

        if (normalizedStatus === "matched") {
          setBet({ status: "filled", orderId, error: null });
          return;
        }

        if (normalizedStatus === "delayed" || normalizedStatus === "pending") {
          setBet({ status: "pending", orderId, error: null });
          return;
        }

        if (normalizedStatus === "live") {
          // Order is resting on the book -- poll for fill
          setBet({ status: "polling", orderId, error: null });

          for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
            await delay(POLL_INTERVAL_MS);

            try {
              const orderData = (await client.getOrder(orderId)) as {
                status?: string;
                orderStatus?: string;
              };
              const polledStatus = (orderData.status ?? orderData.orderStatus ?? "").toUpperCase();

              if (polledStatus === "MATCHED" || polledStatus === "FILLED") {
                setBet({ status: "filled", orderId, error: null });
                return;
              }
              if (polledStatus === "CANCELED" || polledStatus === "CANCELLED") {
                setBet({ status: "cancelled", orderId, error: null });
                return;
              }
              // OPEN / LIVE = still polling -- continue
            } catch {
              // Transient poll error -- keep trying
            }
          }

          // Poll timed out -- order is open but unconfirmed filled
          setBet({ status: "unconfirmed", orderId, error: null });
          return;
        }

        // Unknown status from CLOB -- surface as open with orderId
        setBet({ status: "open", orderId, error: null });
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err);
        console.warn("[useBet] error:", raw);
        setBet({ status: "error", orderId: null, error: mapClobError(raw) });
      }
    },
    [wallets],
  );

  return { bet, placeBet, reset };
}
