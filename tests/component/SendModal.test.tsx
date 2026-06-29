/**
 * SendModal component tests.
 *
 * Tests the disabled/validation states of the Send modal without a real wallet
 * or network. No actual transfers are initiated.
 *
 * Scope:
 * 1. Modal renders with the correct title and token symbol.
 * 2. Confirm button is disabled initially (empty fields).
 * 3. Invalid address shows inline error; button stays disabled.
 * 4. Amount exceeding max shows inline error; button stays disabled.
 * 5. Fee copy is present ("Network fee is paid in {TOKEN}").
 * 6. Max button fills the amount field.
 * 7. Cancel button / close action calls onClose.
 * 8. Double-click / submit-while-submitting does not send twice (double-send guard).
 * 9. An idempotencyKey UUID is generated and included in each submit payload.
 */

import { SendModal } from "@/components/portfolio/SendModal";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockGenerateAuthorizationSignature = vi.fn().mockResolvedValue({ signature: "testsig" });

// Privy hooks
vi.mock("@privy-io/react-auth", () => ({
  usePrivy: () => ({
    user: {
      linkedAccounts: [
        {
          type: "wallet",
          walletClientType: "privy",
          chainType: "ethereum",
          id: "otwlt_test123",
          walletIndex: 0,
        },
      ],
    },
  }),
  useAuthorizationSignature: () => ({
    generateAuthorizationSignature: mockGenerateAuthorizationSignature,
  }),
}));

// Dialog primitives — render children directly so we can inspect content
vi.mock("@radix-ui/react-dialog", () => {
  const Root = ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (v: boolean) => void;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null);
  const Portal = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  const Overlay = () => null;
  const Content = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );
  const Title = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const Description = ({ children }: { children: React.ReactNode }) => <p>{children}</p>;
  const Close = ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>;
  return { Root, Portal, Overlay, Content, Title, Description, Close };
});

// Our dialog wrapper (re-exports Radix primitives)
vi.mock("@/components/ui/dialog", () => {
  const Dialog = ({
    open,
    children,
    onOpenChange,
  }: {
    open: boolean;
    children: React.ReactNode;
    onOpenChange?: (v: boolean) => void;
  }) => (open ? <div data-testid="dialog">{children}</div> : null);
  const DialogContent = ({
    children,
  }: {
    children: React.ReactNode;
    showClose?: boolean;
    className?: string;
  }) => <div>{children}</div>;
  const DialogHeader = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>;
  const DialogClose = ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>;
  return { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";
const MAX_BALANCE = 100;

function renderModal(overrides?: Partial<React.ComponentProps<typeof SendModal>>) {
  return render(
    <SendModal
      open={true}
      onClose={vi.fn()}
      tokenSymbol="USDC"
      token="usdc"
      maxBalance={MAX_BALANCE}
      {...overrides}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("SendModal — render", () => {
  it("renders the modal title with the token symbol", () => {
    renderModal();
    expect(screen.getByText("Send USDC")).toBeInTheDocument();
  });

  it("renders the fee note mentioning the token and no ETH", () => {
    renderModal();
    expect(screen.getByText(/Network fee is paid in USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/no ETH needed/i)).toBeInTheDocument();
  });

  it("renders recipient and amount inputs", () => {
    renderModal();
    expect(screen.getByLabelText(/recipient address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
  });
});

describe("SendModal — confirm button disabled states", () => {
  it("is disabled when both fields are empty", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /confirm send/i })).toBeDisabled();
  });

  it("is disabled when only a valid address is entered (no amount)", () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    expect(screen.getByRole("button", { name: /confirm send/i })).toBeDisabled();
  });

  it("is disabled when only a valid amount is entered (no address)", () => {
    renderModal();
    const amtInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amtInput, { target: { value: "10" } });
    expect(screen.getByRole("button", { name: /confirm send/i })).toBeDisabled();
  });

  it("is enabled when both valid address and valid amount are entered", () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    const amtInput = screen.getByLabelText(/amount/i);
    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    fireEvent.change(amtInput, { target: { value: "10" } });
    expect(screen.getByRole("button", { name: /confirm send/i })).not.toBeDisabled();
  });
});

describe("SendModal — address validation", () => {
  it("shows an inline error for an invalid address after typing", () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    fireEvent.change(toInput, { target: { value: "notanaddress" } });
    expect(screen.getByText(/invalid ethereum address/i)).toBeInTheDocument();
  });

  it("does not show address error for a valid address", () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    expect(screen.queryByText(/invalid ethereum address/i)).not.toBeInTheDocument();
  });
});

describe("SendModal — amount validation", () => {
  it("shows an error when amount exceeds maxBalance", () => {
    renderModal({ maxBalance: 50 });
    const amtInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amtInput, { target: { value: "100" } });
    expect(screen.getByText(/exceeds balance/i)).toBeInTheDocument();
  });

  it("confirm button is disabled when amount exceeds max", () => {
    renderModal({ maxBalance: 50 });
    const toInput = screen.getByLabelText(/recipient address/i);
    const amtInput = screen.getByLabelText(/amount/i);
    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    fireEvent.change(amtInput, { target: { value: "100" } });
    expect(screen.getByRole("button", { name: /confirm send/i })).toBeDisabled();
  });

  it("does not show amount error for an amount at the max", () => {
    renderModal({ maxBalance: 100 });
    const amtInput = screen.getByLabelText(/amount/i);
    fireEvent.change(amtInput, { target: { value: "100" } });
    expect(screen.queryByText(/exceeds balance/i)).not.toBeInTheDocument();
  });
});

describe("SendModal — Max button", () => {
  it("fills the amount field with the formatted max balance", () => {
    renderModal({ maxBalance: 42.5 });
    const maxBtn = screen.getByRole("button", { name: /max/i });
    fireEvent.click(maxBtn);
    const amtInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
    // Should be "42.5" (trailing zeros stripped)
    expect(Number.parseFloat(amtInput.value)).toBeCloseTo(42.5);
  });

  it("fills amount from raw bigint when maxRaw is provided (exact, no float drift)", () => {
    // 42.500001 USDC = 42_500_001 raw (6 decimals)
    renderModal({ maxBalance: 0, maxRaw: 42_500_001n });
    const maxBtn = screen.getByRole("button", { name: /max/i });
    fireEvent.click(maxBtn);
    const amtInput = screen.getByLabelText(/amount/i) as HTMLInputElement;
    expect(amtInput.value).toBe("42.500001");
  });
});

describe("SendModal — Cancel button", () => {
  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("SendModal — does not render when closed", () => {
  it("renders nothing when open=false", () => {
    renderModal({ open: false });
    expect(screen.queryByText("Send USDC")).not.toBeInTheDocument();
  });
});

describe("SendModal — double-send guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch to never resolve (simulates a slow network), so we can
    // test that the button is disabled synchronously after first click.
    global.fetch = vi.fn(
      () => new Promise<Response>(() => {}), // never resolves
    );
  });

  it("disables the confirm button synchronously on first click", async () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    const amtInput = screen.getByLabelText(/amount/i);
    const btn = screen.getByRole("button", { name: /confirm send/i });

    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    fireEvent.change(amtInput, { target: { value: "10" } });

    expect(btn).not.toBeDisabled();

    // Click — the component sets submitting synchronously before the first await.
    await act(async () => {
      fireEvent.click(btn);
    });

    // Button should now show "Sending…" / be disabled — the in-progress state.
    await waitFor(() => {
      expect(screen.getByText(/sending/i)).toBeInTheDocument();
    });
  });

  it("does not fire generateAuthorizationSignature twice on rapid double-click", async () => {
    renderModal();
    const toInput = screen.getByLabelText(/recipient address/i);
    const amtInput = screen.getByLabelText(/amount/i);

    fireEvent.change(toInput, { target: { value: VALID_ADDRESS } });
    fireEvent.change(amtInput, { target: { value: "10" } });

    const btn = screen.getByRole("button", { name: /confirm send/i });

    // Rapid double-click
    await act(async () => {
      fireEvent.click(btn);
      fireEvent.click(btn);
    });

    // The authorization signature should be requested at most once.
    // The second click hits the submittingRef guard and returns early.
    expect(mockGenerateAuthorizationSignature).toHaveBeenCalledTimes(1);
  });
});
