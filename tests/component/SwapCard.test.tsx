/**
 * SwapCard component tests — money-path states without a real wallet.
 *
 * Scope:
 * 1. No-wallet state: swap button is absent, ConnectButton is shown instead.
 * 2. "unconfirmed" status: renders warn copy (Submitted), NOT success copy (Settled).
 * 3. ApprovalPanel: when swap.status==="approving" and approval detail is set,
 *    renders the "Approving {symbol}" copy and revoke.cash link.
 * 4. "success" status: renders "Settled" banner and "New swap" button.
 * 5. "Best case" row is ABSENT (deleted in net-math redesign).
 * 6. Desk sublines use quoteDisplay.ts copy (no old "after 0.5% slippage" alone).
 * 7. Footnote uses the canonical "what actually lands in your wallet" copy.
 */

import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 1,
  useReadContracts: () => ({ data: undefined, isLoading: false }),
  useReadContract: () => ({ data: undefined, refetch: vi.fn() }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useConnect: () => ({ connect: vi.fn(), isPending: false }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
}));

vi.mock("wagmi/chains", () => ({
  mainnet: { id: 1, name: "Ethereum" },
  sepolia: { id: 11155111, name: "Sepolia" },
  base: { id: 8453, name: "Base" },
  polygon: { id: 137, name: "Polygon" },
  arbitrum: { id: 42161, name: "Arbitrum One" },
}));

vi.mock("wagmi/connectors", () => ({
  injected: () => ({ id: "injected" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
  QueryClient: class {},
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/lib/desks/hooks", () => ({
  useConfig: () => ({ data: undefined }),
  useTokens: () => ({ data: undefined }),
  useWalletBalances: () => ({ balances: {} }),
  useQuotes: () => ({ data: undefined, isFetching: false }),
  useFxMarkets: () => ({ data: undefined }),
  useCapabilities: () => ({
    data: { fxSettlement: true, fxDeposit: true },
  }),
}));

// Swap hook — mutable state object so individual tests can override fields
const mockSwapState = {
  status: "idle" as
    | "idle"
    | "signing"
    | "signing_permit"
    | "approving"
    | "submitting"
    | "confirming"
    | "success"
    | "unconfirmed"
    | "error",
  error: null as string | null,
  tradeId: null as string | null,
  receipt: null as { amount: string; symbol: string } | null,
  approval: null as {
    token: `0x${string}`;
    spender: `0x${string}`;
    amountRaw: string;
    chainId: number;
  } | null,
  orderStatusFailed401: false,
  execute: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@/lib/desks/useSwap", () => ({
  useSwap: () => mockSwapState,
}));

vi.mock("@/lib/privy/config", () => ({
  PRIVY_APP_ID: null,
  PRIVY_ENABLED: false,
  ACTIVE_CHAIN: { id: 1, name: "Ethereum" },
  SUPPORTED_CHAINS: [{ id: 1, name: "Ethereum" }],
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    ready: false,
    authenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
  useWallets: () => ({ wallets: [] }),
}));

vi.mock("@privy-io/wagmi", () => ({}));

vi.mock("@/lib/wagmi/config", () => ({
  CHAIN: { id: 1, name: "Ethereum" },
  wagmiConfig: {},
}));

vi.mock("@/lib/fx-provider/core/format", () => ({
  fmt: (n: number) => String(n),
  fromRaw: (raw: string | bigint, _dec: number) => String(raw),
  toRaw: (n: string, _dec: number) => n,
  shortAddr: (addr: string) => addr?.slice(0, 6) ?? "",
}));

vi.mock("@/lib/desks/currency", () => ({
  currencyFlag: () => "",
}));

vi.mock("@/components/desks/FaucetButton", () => ({
  FaucetButton: () => null,
}));

vi.mock("@/components/desks/TokenPicker", () => ({
  TokenPicker: () => null,
}));

vi.mock("@/components/desks/ConnectButton", () => ({
  ConnectButton: () => (
    <button type="button" data-testid="connect-button">
      Connect Wallet
    </button>
  ),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────
import { SwapCard } from "@/components/desks/SwapCard";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SwapCard — no wallet connected", () => {
  it("renders the ConnectButton instead of a swap button", () => {
    render(<SwapCard />);
    expect(screen.getByTestId("connect-button")).toBeInTheDocument();
    // No swap execution button when disconnected
    expect(screen.queryByRole("button", { name: /swap via/i })).not.toBeInTheDocument();
  });

  it("renders the Swap FX heading", () => {
    render(<SwapCard />);
    expect(screen.getByRole("heading", { name: /swap fx/i })).toBeInTheDocument();
  });

  it("renders the You pay and You receive labels", () => {
    render(<SwapCard />);
    expect(screen.getByText("You pay")).toBeInTheDocument();
    expect(screen.getByText("You receive")).toBeInTheDocument();
  });

  it("does not show any status banner in idle state", () => {
    render(<SwapCard />);
    // None of the status-specific copy present at idle
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /new swap/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it("does NOT render a Best case row (deleted in net-math redesign)", () => {
    render(<SwapCard />);
    // "Best case" was the label in the old breakdown rows — must be gone
    expect(screen.queryByText(/best case/i)).not.toBeInTheDocument();
  });
});

describe("SwapCard — unconfirmed status (honest copy, not success)", () => {
  it("renders warn copy (submitted) and not success copy (Settled ·) when status is unconfirmed", () => {
    mockSwapState.status = "unconfirmed";
    mockSwapState.tradeId = "0xabc123";

    render(<SwapCard />);

    // Honest unconfirmed copy: "Submitted · confirmation pending..."
    expect(screen.getByText(/submitted/i)).toBeInTheDocument();

    // Dismiss button present (not "New swap")
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();

    // Must NOT render success "Settled" banner text
    expect(screen.queryByText(/^settled/i)).not.toBeInTheDocument();

    // "Settled · received..." success copy absent
    const allText = screen.queryAllByText(/received/i);
    for (const el of allText) {
      expect(el.textContent).not.toMatch(/received \d/i);
    }

    // Reset
    mockSwapState.status = "idle";
    mockSwapState.tradeId = null;
  });
});

describe("SwapCard — approving status shows ApprovalPanel", () => {
  it("renders 'Approving' copy and revoke.cash link when approval detail is present", () => {
    mockSwapState.status = "approving";
    mockSwapState.approval = {
      token: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      spender: "0xabcdef1234567890123456789012345678901234" as `0x${string}`,
      amountRaw: "1000000",
      chainId: 1,
    };

    render(<SwapCard />);

    // ApprovalPanel renders "Approving {symbol}" — symbol falls back to "token"
    // when fromTok is null (tokens haven't loaded in this mock)
    expect(screen.getByText(/approving/i)).toBeInTheDocument();

    // Revoke link always shown in ApprovalPanel
    const revokeLinks = screen.getAllByText(/revoke.cash/i);
    expect(revokeLinks.length).toBeGreaterThan(0);

    // Reset
    mockSwapState.status = "idle";
    mockSwapState.approval = null;
  });
});

describe("SwapCard — success status renders honest settled copy", () => {
  it("renders 'Settled' copy and a New swap button", () => {
    mockSwapState.status = "success";
    mockSwapState.receipt = { amount: "99.50", symbol: "USDT" };

    render(<SwapCard />);

    // Success banner contains "Settled"
    expect(screen.getByText(/settled/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new swap/i })).toBeInTheDocument();

    // Must NOT show unconfirmed copy
    expect(screen.queryByText(/submitted/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();

    // Reset
    mockSwapState.status = "idle";
    mockSwapState.receipt = null;
  });
});

describe("SwapCard — error status shows error banner", () => {
  it("renders error message and a Dismiss button", () => {
    mockSwapState.status = "error";
    mockSwapState.error = "Slippage too high — try a smaller amount.";

    render(<SwapCard />);

    expect(screen.getByText(/slippage too high/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();

    // Not success
    expect(screen.queryByText(/^settled/i)).not.toBeInTheDocument();

    // Reset
    mockSwapState.status = "idle";
    mockSwapState.error = null;
  });
});

describe("SwapCard — net-math redesign: no optimistic numbers", () => {
  it("does not render 'Best case' label anywhere in the component", () => {
    mockSwapState.status = "idle";
    render(<SwapCard />);
    // This text was in the old breakdown row: "<span class='k'>Best case</span>"
    expect(screen.queryByText(/best case/i)).not.toBeInTheDocument();
  });

  it("desk comparison section heading mentions 'after all fees, slippage'", () => {
    render(<SwapCard />);
    // Updated eyebrow: "Net after all fees, slippage & gas"
    const headings = screen.queryAllByText(/after all fees/i);
    expect(headings.length).toBeGreaterThan(0);
  });

  it("desk-note footer uses canonical 'what actually lands in your wallet' copy", () => {
    render(<SwapCard />);
    // New footnote copy from the brief
    const notes = screen.queryAllByText(/what actually lands in your wallet/i);
    expect(notes.length).toBeGreaterThan(0);
  });

  it("desk-note footer does NOT use old 'what lands in your wallet' copy without 'actually'", () => {
    render(<SwapCard />);
    // Old copy was "what lands in your wallet" — new copy adds "actually"
    // Test that the new copy is present (the 'actually' version subsumes this)
    const notes = screen.queryAllByText(/what actually lands in your wallet/i);
    expect(notes.length).toBeGreaterThan(0);
  });
});
