"use client";

import { useTelegramLogin } from "@/app/providers";
import { AccountChip } from "@/components/account/AccountChip";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PRIVY_ENABLED } from "@/lib/privy/config";
import { useTelegram } from "@/lib/telegram/useTelegram";
import { usePrivy } from "@privy-io/react-auth";
import { Wallet } from "lucide-react";
import { useState } from "react";

/** Disabled fallback when Privy isn't configured. */
function NotConfiguredButton() {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" disabled>
            <Wallet className="size-4" />
            Connect
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Wallet provider not configured. Set NEXT_PUBLIC_PRIVY_APP_ID.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function PrivyConnectButton() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { isTelegram } = useTelegram();
  const { loginForTelegram } = useTelegramLogin();
  const [pending, setPending] = useState(false);

  if (!ready) {
    return (
      <Button variant="secondary" disabled className="min-w-[112px]">
        <span className="size-3.5 animate-[spin_1s_linear_infinite] rounded-full border-2 border-current border-t-transparent" />
      </Button>
    );
  }

  if (!authenticated) {
    return (
      <Button
        variant="primary"
        onClick={async () => {
          setPending(true);
          try {
            if (isTelegram && loginForTelegram) {
              // Inside Telegram WebView: attempt Telegram-native login.
              // Falls back to email-only modal if TG login isn't enabled in Privy dashboard.
              await loginForTelegram();
            } else {
              // Normal browser: full login modal (Google, Apple, WalletConnect, email).
              await login();
            }
          } finally {
            setPending(false);
          }
        }}
        disabled={pending}
      >
        <Wallet className="size-4" />
        Connect
      </Button>
    );
  }

  const address = user?.wallet?.address ?? null;

  return <AccountChip address={address} onLogout={logout} />;
}

/**
 * Wallet connect entry point. Routes to a disabled fallback when Privy is
 * not configured so static prerender / dev-without-creds both work.
 *
 * Inside the Telegram WebView: attempts zero-click Telegram-native login via
 * Privy's useLoginWithTelegram hook. Falls back to email-only modal if the
 * Privy dashboard hasn't enabled Telegram login yet — never crashes.
 */
export function ConnectButton() {
  if (!PRIVY_ENABLED) return <NotConfiguredButton />;
  return <PrivyConnectButton />;
}
