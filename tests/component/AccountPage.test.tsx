/**
 * tests/component/AccountPage.test.tsx
 *
 * Component tests for the /account page:
 *   1. Disconnected state — shows connect prompt, not tab content.
 *   2. Tab rendering — all 4 tabs are present and the Wallet tab starts active.
 *   3. Tab activation — clicking a tab sets aria-selected correctly (Radix behavior).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined, isConnected: false }),
  useChainId: () => 1,
  useSendTransaction: () => ({ sendTransactionAsync: vi.fn() }),
  useBalance: () => ({ data: null }),
  useSignTypedData: () => ({ signTypedDataAsync: vi.fn() }),
  useReadContracts: () => ({ data: null, isLoading: false }),
}));

vi.mock("wagmi/chains", () => ({
  mainnet: { id: 1, name: "Ethereum" },
  sepolia: { id: 11155111, name: "Sepolia" },
  base: { id: 8453, name: "Base" },
  polygon: { id: 137, name: "Polygon" },
  arbitrum: { id: 42161, name: "Arbitrum One" },
}));

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
  useWallets: () => ({ wallets: [] }),
  useExportWallet: () => ({ exportWallet: vi.fn() }),
  useLinkAccount: () => ({
    linkEmail: vi.fn(),
    linkGoogle: vi.fn(),
    linkApple: vi.fn(),
    linkWallet: vi.fn(),
  }),
}));

vi.mock("@/components/shared/Nav", () => ({
  Nav: () => <nav data-testid="nav" />,
}));

vi.mock("@/components/shared/ConnectButton", () => ({
  ConnectButton: () => (
    <button type="button" data-testid="connect-btn">
      Connect
    </button>
  ),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/account",
}));

vi.mock("@/components/account/WalletTab", () => ({
  WalletTab: () => <div data-testid="wallet-tab-content">Wallet</div>,
}));
vi.mock("@/components/account/ActivityTab", () => ({
  ActivityTab: () => <div data-testid="activity-tab-content">Activity</div>,
}));
vi.mock("@/components/account/SettingsTab", () => ({
  SettingsTab: () => <div data-testid="settings-tab-content">Settings</div>,
}));
vi.mock("@/components/account/SecurityTab", () => ({
  SecurityTab: () => <div data-testid="security-tab-content">Security</div>,
}));

// ─── Disconnected suite ───────────────────────────────────────────────────────

describe("AccountPage — disconnected state", () => {
  it("renders a connect button when not connected", async () => {
    const { default: AccountPage } = await import("@/app/account/page");
    render(<AccountPage />);
    expect(screen.getByTestId("connect-btn")).toBeInTheDocument();
  });

  it("does not render wallet tab content when disconnected", async () => {
    const { default: AccountPage } = await import("@/app/account/page");
    render(<AccountPage />);
    expect(screen.queryByTestId("wallet-tab-content")).not.toBeInTheDocument();
  });

  it("does not render activity tab content when disconnected", async () => {
    const { default: AccountPage } = await import("@/app/account/page");
    render(<AccountPage />);
    expect(screen.queryByTestId("activity-tab-content")).not.toBeInTheDocument();
  });
});

// ─── Tab rendering suite (isolated, using Tabs directly) ─────────────────────

describe("Account tab switching — Radix Tabs", () => {
  async function renderTabs(defaultValue = "wallet") {
    const { Tabs, TabsList, TabsTrigger, TabsContent } = await import("@/components/ui/tabs");
    render(
      <Tabs defaultValue={defaultValue}>
        <TabsList>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="wallet">Wallet content</TabsContent>
        <TabsContent value="activity">Activity content</TabsContent>
        <TabsContent value="settings">Settings content</TabsContent>
        <TabsContent value="security">Security content</TabsContent>
      </Tabs>,
    );
  }

  it("renders all 4 tab triggers", async () => {
    await renderTabs();
    expect(screen.getByRole("tab", { name: /wallet/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /activity/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /security/i })).toBeInTheDocument();
  });

  it("Wallet tab is selected by default", async () => {
    await renderTabs("wallet");
    const walletTab = screen.getByRole("tab", { name: /wallet/i });
    expect(walletTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /activity/i })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("clicking Activity tab sets it as selected", async () => {
    await renderTabs("wallet");
    const activityTab = screen.getByRole("tab", { name: /activity/i });
    fireEvent.mouseDown(activityTab); // Radix Tabs activate on pointer-down, not click
    expect(activityTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /wallet/i })).toHaveAttribute("aria-selected", "false");
  });

  it("clicking Settings tab sets it as selected", async () => {
    await renderTabs("wallet");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /settings/i }));
    expect(screen.getByRole("tab", { name: /settings/i })).toHaveAttribute("aria-selected", "true");
  });

  it("clicking Security tab sets it as selected", async () => {
    await renderTabs("wallet");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /security/i }));
    expect(screen.getByRole("tab", { name: /security/i })).toHaveAttribute("aria-selected", "true");
  });

  it("Activity is default when defaultValue=activity", async () => {
    await renderTabs("activity");
    expect(screen.getByRole("tab", { name: /activity/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /wallet/i })).toHaveAttribute("aria-selected", "false");
  });
});
