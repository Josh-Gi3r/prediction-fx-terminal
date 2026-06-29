"use client";

import { PRIVY_ENABLED } from "@/lib/privy/config";
import { usePrivy } from "@privy-io/react-auth";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useConnect } from "wagmi";
import { injected } from "wagmi/connectors";

interface Props {
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Connect button that opens the Privy login modal when Privy is configured —
 * mobile browsers and Telegram mini apps have no injected wallet, so the
 * injected connector alone is a dead end there. Falls back to the injected
 * connector when Privy is off. PRIVY_ENABLED is a build-time constant, so the
 * branch is stable; split into two components to keep hook order static.
 */
export function ConnectWalletButton(props: Props) {
  return PRIVY_ENABLED ? <PrivyConnect {...props} /> : <InjectedConnect {...props} />;
}

function PrivyConnect({
  label = "Connect wallet",
  className = "btn btn-primary btn-block btn-lg",
  style,
}: Props) {
  const { ready, login } = usePrivy();
  const [pending, setPending] = useState(false);
  const busy = !ready || pending;
  return (
    <button
      type="button"
      className={className}
      style={{ ...style, opacity: busy ? 0.6 : 1 }}
      disabled={busy}
      onClick={async () => {
        setPending(true);
        try {
          await login();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Connecting…" : label}
    </button>
  );
}

function InjectedConnect({
  label = "Connect wallet",
  className = "btn btn-primary btn-block btn-lg",
  style,
}: Props) {
  const { connect, isPending } = useConnect();
  return (
    <button
      type="button"
      className={className}
      style={{ ...style, opacity: isPending ? 0.6 : 1 }}
      disabled={isPending}
      onClick={() => connect({ connector: injected() })}
    >
      {isPending ? "Connecting…" : label}
    </button>
  );
}
