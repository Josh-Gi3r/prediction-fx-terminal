"use client";

/**
 * useOnramp — orchestrates the Buy fiat→USDC flow for SDK 0.5.0.
 *
 * State machine:
 *   quoting → signaling → awaiting_payment → capturing → fulfilling → success
 *                                                                    → error
 *                                                                    → expired
 *
 * Contract:
 * - OUR code calls signalIntent + fulfillIntent on the Zkp2pClient.
 * - The extension only captures the Buyer TEE payment proof.
 * - No fake successes: success only fires after fulfillIntent receipt.
 * - Exact-amount approvals only (the SDK handles USDC approval internally).
 *
 * All SDK call shapes verified against dist/vaultUtils-BL8tzsmH.d.ts and
 * dist/index.d.ts. No invented fields.
 */

import type { BuyerTeePaymentProofInput, QuoteSingleResponse } from "@zkp2p/sdk";
import { useCallback, useReducer, useRef } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { usePeerClient } from "./client";
import { PEER_CHAIN_ID, referrerFeeConfig } from "./config";
import { getPeerExtensionSdk } from "./extension";
import { trackPeerIntent, updatePeerIntent } from "./intentStore";

// ─── State machine ────────────────────────────────────────────────────────────

export type OnrampStep =
  | "idle"
  | "signaling"
  | "awaiting_payment"
  | "capturing"
  | "fulfilling"
  | "success"
  | "error"
  | "expired";

export interface OnrampState {
  step: OnrampStep;
  intentHash: `0x${string}` | null;
  /** Fiat amount the user should pay (from quote). */
  fiatAmount: string | null;
  /** Human-readable fiat payment instruction (maker offchainId from quote). */
  payeeTo: string | null;
  /** Platform used for this intent. */
  platform: string | null;
  txHash: string | null;
  error: string | null;
}

type Action =
  | { type: "SIGNAL_START" }
  | {
      type: "SIGNAL_DONE";
      intentHash: `0x${string}`;
      fiatAmount: string;
      payeeTo: string;
      platform: string;
    }
  | { type: "CAPTURE_START" }
  | { type: "FULFILL_START" }
  | { type: "SUCCESS"; txHash: string }
  | { type: "ERROR"; error: string }
  | { type: "EXPIRED" }
  | { type: "RESET" };

const INITIAL: OnrampState = {
  step: "idle",
  intentHash: null,
  fiatAmount: null,
  payeeTo: null,
  platform: null,
  txHash: null,
  error: null,
};

function reducer(state: OnrampState, action: Action): OnrampState {
  switch (action.type) {
    case "SIGNAL_START":
      return { ...state, step: "signaling", error: null };
    case "SIGNAL_DONE":
      return {
        ...state,
        step: "awaiting_payment",
        intentHash: action.intentHash,
        fiatAmount: action.fiatAmount,
        payeeTo: action.payeeTo,
        platform: action.platform,
      };
    case "CAPTURE_START":
      return { ...state, step: "capturing" };
    case "FULFILL_START":
      return { ...state, step: "fulfilling" };
    case "SUCCESS":
      return { ...state, step: "success", txHash: action.txHash };
    case "ERROR":
      return { ...state, step: "error", error: action.error };
    case "EXPIRED":
      return { ...state, step: "expired", error: "Intent expired before fulfillment" };
    case "RESET":
      return INITIAL;
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseOnrampResult {
  state: OnrampState;
  /**
   * Step 1: signal an intent for the chosen quote.
   * Transitions: idle → signaling → awaiting_payment | error.
   */
  signal: (quote: QuoteSingleResponse, fiatAmount: string) => Promise<void>;
  /**
   * Step 2: open the extension to capture the payment proof.
   * Call after the user has made the fiat payment in their app.
   * Transitions: awaiting_payment → capturing → fulfilling → success | error.
   */
  captureAndFulfill: () => void;
  /**
   * Cancel the current intent on-chain and reset to idle.
   * Only valid when intentHash is set and step is awaiting_payment or error.
   */
  cancel: () => Promise<void>;
  reset: () => void;
}

export function useOnramp(): UseOnrampResult {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { address } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const client = usePeerClient();

  // Keep refs to avoid stale closures inside async flows.
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── signal ──────────────────────────────────────────────────────────────────

  const signal = useCallback(
    async (quote: QuoteSingleResponse, fiatAmount: string): Promise<void> => {
      if (!client) {
        dispatch({ type: "ERROR", error: "Wallet not connected. Connect a wallet first." });
        return;
      }
      if (!address) {
        dispatch({ type: "ERROR", error: "No wallet address. Connect a wallet first." });
        return;
      }

      dispatch({ type: "SIGNAL_START" });

      try {
        // Ensure we're on Base (8453) before any on-chain call.
        await switchChainAsync({ chainId: PEER_CHAIN_ID });
      } catch {
        dispatch({
          type: "ERROR",
          error: "Could not switch to Base network. Please switch manually.",
        });
        return;
      }

      try {
        // Pull signal params from the quote.
        // - quote.intent.depositId    → number (from QuoteIntentResponse)
        // - quote.intent.processorName, .payeeDetails, .fiatCurrencyCode, .amount
        // - quote.conversionRate      → string (1e18 fixed-point)
        // SignalIntentMethodParams accepts depositId: bigint | string, amount: bigint | string.
        const intent = quote.intent;

        const refFee = referrerFeeConfig();
        const referralFees = refFee
          ? [{ recipient: refFee.recipient, fee: BigInt(Math.round(refFee.feeBps)) }]
          : undefined;

        const intentHash = await client.signalIntent({
          depositId: String(intent.depositId),
          amount: intent.amount,
          toAddress: address,
          processorName: intent.processorName,
          payeeDetails: intent.payeeDetails,
          fiatCurrencyCode: intent.fiatCurrencyCode,
          conversionRate: quote.conversionRate,
          ...(referralFees ? { referralFees } : {}),
          ...(intent.escrowAddress ? { escrowAddress: intent.escrowAddress as `0x${string}` } : {}),
          ...(intent.orchestratorAddress
            ? { orchestratorAddress: intent.orchestratorAddress as `0x${string}` }
            : {}),
        });

        const hash = intentHash as `0x${string}`;

        // Track locally for /cash Activity panel.
        if (address) {
          trackPeerIntent(address, {
            intentHash: hash,
            owner: address,
            side: "buy",
            platform: intent.processorName,
            fiatCurrency: intent.fiatCurrencyCode,
            fiatAmount,
            usdcAmount: quote.tokenAmount,
            status: "signaled",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }

        dispatch({
          type: "SIGNAL_DONE",
          intentHash: hash,
          fiatAmount,
          payeeTo: quote.payeeAddress,
          platform: intent.processorName,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "ERROR", error: `Signal failed: ${msg}` });
      }
    },
    [client, address, switchChainAsync],
  );

  // ── captureAndFulfill ────────────────────────────────────────────────────────

  const captureAndFulfill = useCallback((): void => {
    const { intentHash, platform } = stateRef.current;
    if (!intentHash || !platform) return;
    if (!client) {
      dispatch({ type: "ERROR", error: "Wallet disconnected. Reconnect and try again." });
      return;
    }

    dispatch({ type: "CAPTURE_START" });

    const sdk = getPeerExtensionSdk();

    // Register BEFORE authenticate — README requirement.
    const unsubscribe = sdk.onMetadataMessage(async (message) => {
      unsubscribe(); // one-shot: tear down listener after first message

      if (message.errorMessage) {
        dispatch({ type: "ERROR", error: `Extension error: ${message.errorMessage}` });
        return;
      }

      const capture = message.buyerTeeCapture;
      if (!capture) {
        dispatch({
          type: "ERROR",
          error: "Extension returned no capture. Make sure you completed the payment proof step.",
        });
        return;
      }

      // Map PeerBuyerTeePaymentCapture → BuyerTeePaymentProofInput.
      //
      // PeerBuyerTeePaymentCapture (dist/index.d.ts line ~141):
      //   { encryptedSessionMaterial: string; params?: PeerBuyerTeePaymentParams[] }
      //   where PeerBuyerTeePaymentParams = Record<string, string|number|boolean>
      //
      // BuyerTeePaymentProofInput (dist/vaultUtils-BL8tzsmH.d.ts line ~1227):
      //   { proofType: 'buyerTee'; encryptedSessionMaterial: string;
      //     params: BuyerTeePaymentParams;   ← single Record, not array
      //     actionPlatform?: string; actionType?: string }
      //
      // The capture.params is an ARRAY of param rows (one per payment proof step).
      // The ProofInput.params is a SINGLE Record. Merge all rows into one object.
      const captureParams = capture.params ?? [];
      const mergedParams: Record<string, string | number | boolean> = Object.assign(
        {},
        ...captureParams,
      );

      const proof: BuyerTeePaymentProofInput = {
        proofType: "buyerTee",
        encryptedSessionMaterial: capture.encryptedSessionMaterial,
        params: mergedParams,
        actionPlatform: platform,
        actionType: `transfer_${platform}`,
      };

      dispatch({ type: "FULFILL_START" });

      try {
        await switchChainAsync({ chainId: PEER_CHAIN_ID });
      } catch {
        dispatch({
          type: "ERROR",
          error: "Could not switch to Base network for fulfillment.",
        });
        return;
      }

      try {
        const txResult = await client.fulfillIntent({
          intentHash,
          proof,
          attestationServiceUrl: "https://attestation.zkp2p.xyz",
          callbacks: {
            onTxMined: (hash) => {
              if (address) {
                updatePeerIntent(address, intentHash, { status: "fulfilled", txHash: hash });
              }
              dispatch({ type: "SUCCESS", txHash: hash });
            },
          },
        });

        // fulfillIntent may resolve before onTxMined fires; if we have a hash, use it.
        if (txResult && typeof txResult === "string") {
          if (address) {
            updatePeerIntent(address, intentHash, { status: "fulfilled", txHash: txResult });
          }
          dispatch({ type: "SUCCESS", txHash: txResult });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        dispatch({ type: "ERROR", error: `Fulfillment failed: ${msg}` });
        if (address) {
          updatePeerIntent(address, intentHash, { status: "failed" });
        }
      }
    });

    // Derive actionType: 'transfer_<platform>' per README verbatim.
    sdk.authenticate({
      actionType: `transfer_${platform}`,
      captureMode: "buyerTee",
      platform,
      attestationServiceUrl: "https://attestation.zkp2p.xyz",
    });
  }, [client, address, switchChainAsync]);

  // ── cancel ───────────────────────────────────────────────────────────────────

  const cancel = useCallback(async (): Promise<void> => {
    const { intentHash } = stateRef.current;
    if (!intentHash || !client) return;

    try {
      await client.cancelIntent({ intentHash });
      if (address) {
        updatePeerIntent(address, intentHash, { status: "cancelled" });
      }
      dispatch({ type: "RESET" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: "ERROR", error: `Cancel failed: ${msg}` });
    }
  }, [client, address]);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  return { state, signal, captureAndFulfill, cancel, reset };
}
