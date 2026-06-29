/**
 * Wallet-absent surface tests.
 *
 * Verifies that key surfaces show a connect prompt or disabled state
 * when no wallet is connected, rather than an active money-path action.
 *
 * Surfaces covered:
 * 1. ConnectButton (shared) — renders disabled pill when PRIVY_ENABLED=false.
 * 2. ConnectWalletButton stub — renders connect label and custom label (mock contract).
 * 3. desks/ConnectButton — shows connect prompt when not connected.
 *
 * NOT covered:
 * - Full EarnCard deposit flow: VLPanel calls @wagmi/core imperative functions
 *   (readContract, writeContract, sendTransaction) outside the React hook system.
 *   Mocking would assert mock internals, not real component behaviour. Skipped.
 * - Privy-authenticated connect flow: Privy iframe is cross-origin; boundary
 *   is tested in wallet.spec.ts.
 */

import { ConnectButton as DesksConnectButton } from "@/components/desks/ConnectButton";
import { ConnectButton as SharedConnectButton } from "@/components/shared/ConnectButton";
// ConnectWalletButton import resolves to the vi.mock stub (hoisted) — we use it directly
import { ConnectWalletButton } from "@/components/shared/ConnectWalletButton";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

// ── Module-level mocks ────────────────────────────────────────────────────────

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 1,
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

vi.mock("@/lib/wagmi/config", () => ({
  CHAIN: { id: 1, name: "Ethereum" },
  wagmiConfig: {},
}));

vi.mock("@/lib/fx-provider/core/format", () => ({
  shortAddr: (addr: string) => addr?.slice(0, 6) ?? "",
}));

// Privy OFF — stable state for all tests in this file
vi.mock("@/lib/privy/config", () => ({
  PRIVY_APP_ID: null,
  PRIVY_ENABLED: false,
}));

vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    ready: false,
    authenticated: false,
    user: null,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    variant?: string;
    className?: string;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
  TooltipTrigger: ({
    children,
    asChild: _a,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Use the real lucide-react (icons are plain SVGs, harmless in jsdom) so
// adding an icon to any component never breaks this suite.

// desks/ConnectButton renders ConnectWalletButton — give it a testable stub
vi.mock("@/components/shared/ConnectWalletButton", () => ({
  ConnectWalletButton: ({ label }: { label?: string }) => (
    <button type="button" data-testid="cwb">
      {label ?? "Connect Wallet"}
    </button>
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("shared/ConnectButton — PRIVY_ENABLED=false", () => {
  it("renders a disabled Connect button", () => {
    render(<SharedConnectButton />);
    const btn = screen.getByRole("button", { name: /connect/i });
    expect(btn).toBeDisabled();
  });

  it("shows tooltip copy about missing NEXT_PUBLIC_PRIVY_APP_ID", () => {
    render(<SharedConnectButton />);
    expect(screen.getByText(/NEXT_PUBLIC_PRIVY_APP_ID/i)).toBeInTheDocument();
  });
});

describe("ConnectWalletButton stub — mock contract verification", () => {
  // The real ConnectWalletButton (PRIVY_ENABLED=false → InjectedConnect) is mocked here
  // to a testable stub. These tests verify the mock contract the desks/ConnectButton tests rely on.
  it("renders default 'Connect Wallet' label", () => {
    render(<ConnectWalletButton />);
    expect(screen.getByTestId("cwb")).toHaveTextContent("Connect Wallet");
  });

  it("renders custom label when provided", () => {
    render(<ConnectWalletButton label="Fund to earn" />);
    expect(screen.getByTestId("cwb")).toHaveTextContent("Fund to earn");
  });
});

describe("desks/ConnectButton — not connected (isConnected=false)", () => {
  it("renders connect prompt via ConnectWalletButton when not connected", () => {
    render(<DesksConnectButton />);

    // desks/ConnectButton renders ConnectWalletButton (our stub) when not connected
    const btn = screen.getByTestId("cwb");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent(/connect wallet/i);
  });

  it("does not render a disconnect button when not connected", () => {
    render(<DesksConnectButton />);
    // No address displayed, no disconnect/title button
    expect(screen.queryByTitle(/disconnect/i)).not.toBeInTheDocument();
  });
});

// ─── Skip note ────────────────────────────────────────────────────────────────
// VLPanel earn deposit button:
//   Calls @wagmi/core imperative APIs (readContract, writeContract, sendTransaction)
//   outside the React hook system. Mocking wagmiConfig + those imperatives produces
//   a test that verifies the mock, not the component. Skipped; covered by E2E.
