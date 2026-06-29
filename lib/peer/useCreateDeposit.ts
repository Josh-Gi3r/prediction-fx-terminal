"use client";

/**
 * lib/peer/useCreateDeposit.ts
 *
 * Hook encapsulating the full multi-step deposit creation flow:
 *   1. ensureAllowance (exact-amount, maxApprove:false)
 *   2. createDeposit  (multi-platform, intentAmountRange, retainOnEmpty)
 *   3. (optional) resolveDepositIdFromReceipt → setDepositWhitelistHook
 *   4. (optional) setRateManager vault delegation
 *   5. trackPeerDeposit + toast
 *
 * Returns: { btnState, isPending, handleSubmit }
 *
 * Callers own form state and pass it in at submit time.
 */

import React from "react";

import type { P2pVault } from "@/app/api/p2p/vaults/route";
import { toast } from "@/components/ui/toast";
import { usePeerClient } from "@/lib/peer/client";
import {
  PEER_PAYMENT_PLATFORMS,
  USDC_BASE,
  parseUnitsExact,
  usdcToBaseUnits,
} from "@/lib/peer/config";
import { resolveDepositIdFromReceipt } from "@/lib/peer/depositReceipt";
import { trackPeerDeposit } from "@/lib/peer/intentStore";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import type { AdvancedSettings, PlatformEntry } from "../../components/peer/sell/types";
import { newPlatformEntry } from "../../components/peer/sell/types";

// ─── types ────────────────────────────────────────────────────────────────────

export type DepositBtnState = "idle" | "approving" | "creating" | "whitelisting" | "delegating";

export interface UseCreateDepositResult {
  btnState: DepositBtnState;
  isPending: boolean;
  handleSubmit: (args: SubmitArgs) => Promise<void>;
}

interface SubmitArgs {
  usdcAmount: string;
  platforms: PlatformEntry[];
  advanced: AdvancedSettings;
  selectedVault: P2pVault | null;
  /** Called on success to allow the parent to reset form state. */
  onSuccess: (resetPlatform: PlatformEntry) => void;
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function useCreateDeposit(): UseCreateDepositResult {
  const { address } = useAccount();
  const client = usePeerClient();
  const [btnState, setBtnState] = React.useState<DepositBtnState>("idle");
  const isPending = btnState !== "idle";

  const handleSubmit = React.useCallback(
    async ({ usdcAmount, platforms, advanced, selectedVault, onSuccess }: SubmitArgs) => {
      if (!client) {
        toast.error({ title: "No wallet", description: "Connect a wallet on Base to sell." });
        return;
      }
      if (!address) {
        toast.error({ title: "No address", description: "Wallet not connected." });
        return;
      }

      const usdcNum = Number(usdcAmount);
      if (!usdcNum || usdcNum < 10) {
        toast.error({ title: "Amount too small", description: "Minimum deposit is 10 USDC." });
        return;
      }

      // Validate each platform entry
      for (const entry of platforms) {
        if (!entry.offchainId.trim()) {
          toast.error({
            title: "Payment ID required",
            description: `Enter your ${entry.platform.displayName} ID.`,
          });
          return;
        }
        if (entry.currencies.length === 0) {
          toast.error({
            title: "Currency required",
            description: `Add at least one currency for ${entry.platform.displayName}.`,
          });
          return;
        }
      }

      // Validate order limits
      const minOrderNum = Number(advanced.minOrder);
      const maxOrderNum = Number(advanced.maxOrder);
      if (!Number.isFinite(minOrderNum) || minOrderNum < 1) {
        toast.error({
          title: "Invalid min order",
          description: "Min per order must be at least 1.",
        });
        return;
      }
      if (!Number.isFinite(maxOrderNum) || maxOrderNum < minOrderNum) {
        toast.error({
          title: "Invalid max order",
          description: "Max per order must be >= min.",
        });
        return;
      }

      // Private orderbook whitelist hook — must be a valid contract address if on.
      const whitelistHook = advanced.whitelistHook.trim();
      const wantsWhitelist = advanced.whitelistEnabled && whitelistHook !== "";
      if (advanced.whitelistEnabled && whitelistHook === "") {
        toast.error({
          title: "Whitelist hook required",
          description: "Enter the whitelist hook contract address, or turn off Private Orderbook.",
        });
        return;
      }
      if (wantsWhitelist && !isAddress(whitelistHook)) {
        toast.error({
          title: "Invalid hook address",
          description: "The whitelist hook must be a valid contract address.",
        });
        return;
      }

      const amountBigint = usdcToBaseUnits(usdcAmount);
      const minIntent = usdcToBaseUnits(advanced.minOrder);
      // cap maxIntent at total deposit amount
      const rawMax = usdcToBaseUnits(advanced.maxOrder);
      const maxIntent = rawMax > amountBigint ? amountBigint : rawMax;

      // Build per-platform arrays for createDeposit
      const processorNames = platforms.map((e) => e.platform.key);
      const payeeData = platforms.map((e) => ({ offchainId: e.offchainId.trim() }));
      const conversionRates = platforms.map((entry) =>
        entry.currencies.map((fiat) => {
          const rateVal = entry.rates[fiat.code];
          const r = rateVal && Number(rateVal) > 0 ? rateVal : "1.0000";
          const rateStr = parseUnitsExact(r, 18).toString();
          return { currency: fiat.code, conversionRate: rateStr };
        }),
      );

      try {
        // Step 1: exact-amount approval
        setBtnState("approving");
        const { hadAllowance, hash: approvalHash } = await client.ensureAllowance({
          token: USDC_BASE,
          amount: amountBigint,
          maxApprove: false,
        });
        if (!hadAllowance && approvalHash) {
          toast.info({
            title: "Approval sent",
            description: `USDC approved. Tx: ${approvalHash.slice(0, 10)}…`,
          });
        }

        // Step 2: createDeposit — all verified params
        setBtnState("creating");
        const { hash } = await client.createDeposit({
          token: USDC_BASE,
          amount: amountBigint,
          intentAmountRange: { min: minIntent, max: maxIntent },
          processorNames,
          payeeData,
          conversionRates,
          retainOnEmpty: advanced.retainOnEmpty,
        });

        trackPeerDeposit(address, {
          depositId: hash,
          owner: address,
          platforms: processorNames,
          usdcAmount,
          status: "active",
          createdAt: Date.now(),
        });

        // Resolve the on-chain depositId of the deposit we just created — needed
        // for both the whitelist hook and vault delegation (both keyed by id, not
        // by the createDeposit tx hash). Fetched lazily, only when one is needed.
        //
        // Primary path: parse the DepositReceived event from the tx receipt.
        // This is race-safe — we read back exactly the depositId our tx emitted,
        // not the global max which can skew when two deposits land concurrently.
        // Fallback: getAccountDeposits + max-id, kept as a last resort when the
        // receipt parse returns null (e.g. ABI mismatch on a future SDK upgrade).
        let newestDepositId: bigint | null = null;
        const needsPostDeposit =
          wantsWhitelist ||
          Boolean(selectedVault?.rateManagerAddress && selectedVault.rateManagerId);
        if (needsPostDeposit) {
          newestDepositId = await resolveDepositIdFromReceipt(
            client,
            hash,
            address as `0x${string}`,
          );
          if (newestDepositId === null) {
            // Last-resort fallback: fetch all deposits and take the max id.
            // Susceptible to the concurrent-deposit race but better than nothing.
            try {
              const views = await client.getAccountDeposits(address as `0x${string}`);
              newestDepositId = views.reduce<bigint | null>((best, v) => {
                if (best === null || v.depositId > best) return v.depositId;
                return best;
              }, null);
            } catch {
              newestDepositId = null;
            }
          }
        }

        // Step 3 (optional): private orderbook whitelist hook — post-deposit tx.
        let whitelistHash: `0x${string}` | null = null;
        if (wantsWhitelist) {
          setBtnState("whitelisting");
          if (newestDepositId !== null) {
            try {
              whitelistHash = await client.setDepositWhitelistHook({
                depositId: newestDepositId,
                whitelistHook: whitelistHook as `0x${string}`,
              });
            } catch (hookErr) {
              const msg = hookErr instanceof Error ? hookErr.message : String(hookErr);
              toast.error({
                title: "Whitelist not applied · deposit is live",
                description: `Deposit created. Hook failed: ${msg.slice(0, 150)}.`,
              });
            }
          } else {
            toast.error({
              title: "Whitelist not applied · deposit is live",
              description: "Could not resolve the new deposit id to attach the whitelist hook.",
            });
          }
        }
        if (whitelistHash) {
          toast.info({
            title: "Private orderbook set",
            description: `Whitelist hook attached. Tx: ${whitelistHash.slice(0, 10)}…`,
          });
        }

        // Step 4 (optional): vault delegation — post-deposit tx
        if (selectedVault?.rateManagerAddress && selectedVault.rateManagerId) {
          setBtnState("delegating");
          try {
            const newest = newestDepositId !== null ? { depositId: newestDepositId } : null;

            if (newest) {
              const delegateHash = await client.setRateManager({
                depositId: newest.depositId,
                rateManagerAddress: selectedVault.rateManagerAddress as `0x${string}`,
                rateManagerId: selectedVault.rateManagerId as `0x${string}`,
              });
              toast.success({
                title: "Deposit live · vault delegation set",
                description: `${usdcAmount} USDC listed. Rate management delegated to ${selectedVault.name}. Deposit: ${hash.slice(0, 10)}… Delegation: ${delegateHash.slice(0, 10)}…`,
                ttlMs: 10_000,
              });
            } else {
              toast.success({
                title: "Deposit live",
                description: `${usdcAmount} USDC listed. Delegate to ${selectedVault.name} from the vault detail page. Tx: ${hash.slice(0, 10)}…`,
                ttlMs: 10_000,
              });
            }
          } catch (delegateErr) {
            const msg = delegateErr instanceof Error ? delegateErr.message : String(delegateErr);
            toast.error({
              title: "Delegation failed · deposit is live",
              description: `Deposit created. Delegation failed: ${msg.slice(0, 150)}.`,
            });
          }
        } else {
          const platformNames = platforms.map((e) => e.platform.displayName).join(", ");
          toast.success({
            title: "Deposit live",
            description: `${usdcAmount} USDC listed on ${platformNames}. Tx: ${hash.slice(0, 10)}…`,
            ttlMs: 8000,
          });
        }

        // reset via callback
        const resetPlatform = newPlatformEntry(PEER_PAYMENT_PLATFORMS[0] ?? platforms[0]!.platform);
        onSuccess(resetPlatform);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error({ title: "Deposit failed", description: msg.slice(0, 200) });
      } finally {
        setBtnState("idle");
      }
    },
    [client, address],
  );

  return { btnState, isPending, handleSubmit };
}
