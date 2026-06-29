"use client";

import { CommandPalette } from "@/components/shared/CommandPalette";
import { Toaster } from "@/components/ui/toast";
import { ACTIVE_CHAIN, PRIVY_APP_ID, PRIVY_ENABLED, SUPPORTED_CHAINS } from "@/lib/privy/config";
import { purgeLegacyApiKeys } from "@/lib/security/purgeLegacyKeys";
import { standaloneWagmiConfig, wagmiConfig } from "@/lib/wagmi/config";
import { PrivyProvider, useLoginWithTelegram, usePrivy } from "@privy-io/react-auth";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WagmiProvider as StandaloneWagmiProvider } from "wagmi";

/**
 * Single client-side provider wrapper, mounted from `app/layout.tsx`.
 *
 *   PrivyProvider     (auth + embedded wallet, optional)
 *     └─ TelegramLoginBridge (populates TelegramLoginContext, uses Privy hooks)
 *         └─ QueryClientProvider (server state cache, always)
 *             └─ WagmiProvider (chain config + connectors via Privy, optional)
 *                 └─ App + global UI (CommandPalette, Toaster)
 *
 * QueryClient is instantiated lazily once per browser tab so Next.js HMR
 * doesn't reset the cache on every reload.
 *
 * When `NEXT_PUBLIC_PRIVY_APP_ID` is unset (or a placeholder), Privy + Wagmi
 * are skipped entirely — the rest of the app still mounts. ConnectButton
 * detects the missing provider and renders a disabled state.
 *
 * Event content module (WcPromoPopup or equivalent) is NOT mounted here by
 * default. Mount it inside the specific page or layout that needs it so it
 * doesn't overlay every app screen. See app/wc/layout.tsx for the example.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number } | null)?.status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

// ── Telegram-aware login context ─────────────────────────────────────────────
//
// Provides a `loginForTelegram` function that components can call when they
// detect they are inside the Telegram WebView. It attempts Privy's
// useLoginWithTelegram hook; if that fails (method not enabled in the Privy
// dashboard, or any runtime error), it falls back to the standard email-only
// login modal. Outside Telegram, consumers use `login()` from usePrivy() directly.
//
// TelegramLoginContext is populated by TelegramLoginBridge, which mounts inside
// the PrivyProvider tree so it can legally call Privy hooks.

type TelegramLoginFn = () => Promise<void>;

interface TelegramLoginContextValue {
  /** Available once TelegramLoginBridge has mounted inside PrivyProvider. */
  loginForTelegram: TelegramLoginFn | null;
}

export const TelegramLoginContext = createContext<TelegramLoginContextValue>({
  loginForTelegram: null,
});

export function useTelegramLogin() {
  return useContext(TelegramLoginContext);
}

/**
 * Inner bridge — mounted inside PrivyProvider so Privy hooks are available.
 * Builds the `loginForTelegram` function and pushes it into the context.
 *
 * Fallback chain:
 *   1. useLoginWithTelegram().login()  — zero-click Telegram identity
 *   2. usePrivy().login() — FULL modal, same options as desktop (email/wallet/google/apple)
 *      (Google/Apple/WalletConnect are intentionally excluded; they open popups
 *       that are blocked inside the Telegram WebView.)
 */
function TelegramLoginBridge({
  children,
  setLoginFn,
}: {
  children: React.ReactNode;
  setLoginFn: (fn: TelegramLoginFn) => void;
}) {
  const { login: tgLogin } = useLoginWithTelegram();
  const { login: privyLogin } = usePrivy();

  const loginForTelegram = useCallback(async () => {
    try {
      await tgLogin();
    } catch (err) {
      // useLoginWithTelegram throws when:
      //   • "telegram" login method isn't enabled in the Privy dashboard
      //   • The Privy app hasn't been configured with a Telegram bot token
      //   • Any other runtime failure
      // Fall back to the FULL login modal — same options as desktop (email,
      // wallet, google, apple) so a user who signed up with Google on the web
      // can use the SAME account in Telegram (Privy runs OAuth via redirect in
      // the WebView, not a popup). Matching options = same wallet across surfaces.
      console.warn(
        "[TelegramLogin] Telegram-native login unavailable, falling back to full login:",
        err,
      );
      try {
        privyLogin();
      } catch {
        // user dismissed — ignore
      }
    }
  }, [tgLogin, privyLogin]);

  // Register into parent state once per stable identity
  useEffect(() => {
    setLoginFn(loginForTelegram);
  }, [loginForTelegram, setLoginFn]);

  // eslint-disable-next-line react/jsx-no-useless-fragment
  return <>{children}</>;
}

// APP_NAME drives the auth modal header and login message.
// Override via NEXT_PUBLIC_APP_NAME in your environment.
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  // Hold the TG login fn in a REF, not state. useLoginWithTelegram returns a new
  // function reference every render, so storing it in state (via the bridge's
  // effect) caused setState-every-render → React #185 infinite loop. A ref write
  // does not re-render, so the loop is impossible.
  const tgLoginRef = useRef<TelegramLoginFn | null>(null);

  useEffect(() => {
    purgeLegacyApiKeys();
  }, []);

  // Bridge writes the latest fn into the ref (no state, no re-render, no loop).
  const handleSetLoginFn = useCallback((fn: TelegramLoginFn) => {
    tgLoginRef.current = fn;
  }, []);

  // Stable context value: a wrapper that calls whatever the ref currently holds.
  // Created once (deps []), so consumers never re-render from this provider.
  const tgCtx = useMemo<TelegramLoginContextValue>(
    () => ({
      loginForTelegram: async () => {
        if (tgLoginRef.current) await tgLoginRef.current();
      },
    }),
    [],
  );

  const appContent = (
    <QueryClientProvider client={queryClient}>
      {PRIVY_ENABLED ? (
        <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
      ) : (
        <StandaloneWagmiProvider config={standaloneWagmiConfig}>{children}</StandaloneWagmiProvider>
      )}
      <CommandPalette />
      <Toaster />
    </QueryClientProvider>
  );

  if (!PRIVY_ENABLED || PRIVY_APP_ID === null) {
    return (
      <TelegramLoginContext.Provider value={{ loginForTelegram: null }}>
        {appContent}
      </TelegramLoginContext.Provider>
    );
  }

  return (
    <TelegramLoginContext.Provider value={tgCtx}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          // Desktop and non-TG mobile: full method list.
          // TG callers override at call time via loginForTelegram() in TelegramLoginBridge
          // which attempts Telegram-native login then falls back to email-only.
          loginMethods: ["email", "wallet", "google", "apple"],
          appearance: {
            theme: "light",
            accentColor: "#2563eb", // --brand from theme config
            logo: "/brand/logo.png",
            showWalletLoginFirst: false,
            landingHeader: `Sign in to ${APP_NAME}`,
            loginMessage: "Stablecoin FX, prediction markets, and yield. Settled onchain.",
            walletList: [
              "metamask",
              "rainbow",
              "coinbase_wallet",
              "wallet_connect",
              "rabby_wallet",
            ],
          },
          // v3: createOnLogin moved under embeddedWallets.ethereum (top-level createOnLogin removed)
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          defaultChain: ACTIVE_CHAIN,
          supportedChains: [...SUPPORTED_CHAINS],
        }}
      >
        <TelegramLoginBridge setLoginFn={handleSetLoginFn}>{appContent}</TelegramLoginBridge>
      </PrivyProvider>
    </TelegramLoginContext.Provider>
  );
}
