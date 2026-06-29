"use client";

/**
 * Peer browser-extension bridge for on-ramp capture (desktop Chrome only).
 *
 * The extension owns: provider-tab auth + Buyer TEE encrypted session material
 * capture. OUR code owns: signalIntent, fulfillIntent orchestration.
 *
 * This module is NOT the old peerExtensionSdk.onramp() / openSidebar() model —
 * those methods do not exist in SDK 0.5.0. All API calls are sourced from
 * dist/index.d.ts and the README "Extension Metadata Bridge" section.
 */

import {
  PEER_EXTENSION_CHROME_URL,
  type PeerAuthenticateParams,
  type PeerBuyerTeePaymentCapture,
  type PeerExtensionSdk,
  type PeerExtensionState,
  type PeerMetadataMessage,
  createPeerExtensionSdk,
  getPeerExtensionState,
  isPeerExtensionAvailable,
  openPeerExtensionInstallPage,
} from "@zkp2p/sdk";
import { useEffect, useRef, useState } from "react";

export { PEER_EXTENSION_CHROME_URL };
export type { PeerAuthenticateParams, PeerBuyerTeePaymentCapture, PeerMetadataMessage };

// ─── Singleton SDK instance (safe in client components) ───────────────────────

let _peerSdk: PeerExtensionSdk | null = null;
function getPeerSdk(): PeerExtensionSdk {
  if (!_peerSdk) {
    _peerSdk = createPeerExtensionSdk();
  }
  return _peerSdk;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePeerExtension() {
  const [state, setState] = useState<PeerExtensionState | "checking">("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!isPeerExtensionAvailable()) {
        if (!cancelled) setState("needs_install");
        return;
      }
      try {
        const s = await getPeerExtensionState();
        if (!cancelled) setState(s);
      } catch {
        if (!cancelled) setState("needs_connection");
      }
    }
    check();
    // Extension injects asynchronously — re-check briefly after mount.
    const t = setTimeout(check, 1500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  return {
    state,
    /**
     * Request connection from a third-party origin. Required before
     * authenticate() when state === 'needs_connection'.
     */
    connect: (): Promise<boolean> => getPeerSdk().requestConnection(),
    /** Open the Chrome Web Store install page. */
    openInstall: (): void => openPeerExtensionInstallPage(),
    /**
     * Trigger the extension's provider auth tab.
     * Register onMetadataMessage BEFORE calling this.
     * captureMode must be 'buyerTee' for on-ramp.
     */
    authenticate: (params: PeerAuthenticateParams): void => getPeerSdk().authenticate(params),
    /**
     * Subscribe to capture messages from the extension.
     * Returns an unsubscribe function — call it in your cleanup.
     * For on-ramp: watch message.buyerTeeCapture.
     */
    onMetadataMessage: (cb: (msg: PeerMetadataMessage) => void): (() => void) =>
      getPeerSdk().onMetadataMessage(cb),
  };
}

// ─── Standalone helpers (usable outside hooks) ────────────────────────────────

export function getPeerExtensionSdk(): PeerExtensionSdk {
  return getPeerSdk();
}

// ─── usePeerCapture — registers the listener + fires authenticate ─────────────

export interface UsePeerCaptureOptions {
  /** Platform key matching the selected quote (e.g. 'venmo', 'wise'). */
  platform: string;
  /** Called with the captured TEE material when the extension responds. */
  onCapture: (capture: PeerBuyerTeePaymentCapture) => void;
  /** Called when the extension signals an error. */
  onError: (msg: string) => void;
  /** Set true to arm — false to tear down. */
  active: boolean;
}

/**
 * Registers onMetadataMessage, fires authenticate, and cleans up on deactivate.
 * The caller must ensure the extension state === 'ready' before setting active=true.
 */
export function usePeerCapture({
  platform,
  onCapture,
  onError,
  active,
}: UsePeerCaptureOptions): void {
  const onCaptureRef = useRef(onCapture);
  const onErrorRef = useRef(onError);
  onCaptureRef.current = onCapture;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;

    const sdk = getPeerSdk();

    // Register BEFORE authenticate — from README: "register onMetadataMessage first".
    const unsubscribe = sdk.onMetadataMessage((message) => {
      if (message.errorMessage) {
        onErrorRef.current(message.errorMessage);
        return;
      }
      if (message.buyerTeeCapture) {
        onCaptureRef.current(message.buyerTeeCapture);
      }
    });

    // Derive actionType: 'transfer_<platform>' per README verbatim.
    const actionType = `transfer_${platform}`;

    sdk.authenticate({
      actionType,
      captureMode: "buyerTee",
      platform,
      attestationServiceUrl: "https://attestation.zkp2p.xyz",
    });

    return unsubscribe;
  }, [active, platform]);
}
