"use client";

/**
 * components/mobile/earn/EarnHelpSheet.tsx
 * Bottom sheet wired to the AppBar Info button.
 */

export function EarnHelpSheet({ onClose }: { onClose: () => void }) {
  const ITEMS: Array<{ k: string; t: string; d: string }> = [
    {
      k: "VL ★",
      t: "Virtual Liquidity",
      d: "One USDC budget quotes up to 20 SEA-FX corridors at once. Deposit USDC to the settlement vault, then sign one batch of maker orders. The engine freezes only your largest leg, so the same capital earns the spread on every fill.",
    },
    {
      k: "Lend",
      t: "Aave · Pendle · Perp LP",
      d: "Real in-app deposits: supply stablecoins to Aave v3 (live APY), buy Pendle PT for a fixed rate to maturity, or LP Hyperliquid HLP / GMX GM pools to earn the perp spread. You approve the exact amount and sign every transaction.",
    },
    {
      k: "Vaults",
      t: "Delegated FX market-making",
      d: "Delegate USDC to an independent vault manager who quotes fiat⇄USDC across platforms. You earn the realized spread minus the vault fee. Past PNL is not a promise.",
    },
    {
      k: "Smart Yield",
      t: "Best blend by risk",
      d: "Allocates a budget across Aave + Pendle + HLP using live APY and the SDYS risk score. We only compute the split; you sign each leg yourself from the Lend tab.",
    },
    {
      k: "Explore",
      t: "Scored stablecoin yields",
      d: "Research-only table of DeFi stablecoin pools, scored 0–100 on excess over the T-Bill, TVL tier, project tier and IL risk.",
    },
  ];
  return (
    // biome-ignore lint/a11y/useSemanticElements: sheet needs a div for the backdrop + border-radius styling
    <div
      role="dialog"
      aria-modal="true"
      aria-label="How Earn works"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,20,35,.42)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: "8px 18px 26px",
          maxHeight: "82vh",
          overflowY: "auto",
          boxShadow: "0 -8px 40px rgba(15,20,35,.18)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 4,
            background: "var(--line-2)",
            margin: "0 auto 14px",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0, fontFamily: "var(--f-display)", fontWeight: 800, fontSize: 18 }}>
            How Earn works
          </h3>
          <button
            type="button"
            className="iconbtn"
            aria-label="Close"
            onClick={onClose}
            style={{ fontSize: 18, lineHeight: 1, color: "var(--muted)" }}
          >
            ✕
          </button>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55 }}>
          Every flow here is non-custodial. You sign each leg from your own wallet. Nothing is
          custodied on your behalf.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ITEMS.map((it) => (
            <div
              key={it.k}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "13px 14px",
                background: "var(--bg-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span
                  style={{
                    fontFamily: "var(--f-tech)",
                    fontWeight: 800,
                    fontSize: 10,
                    letterSpacing: ".06em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: "var(--grad-brand)",
                    padding: "3px 8px",
                    borderRadius: 6,
                  }}
                >
                  {it.k}
                </span>
                <strong style={{ fontSize: 13.5, color: "var(--ink)" }}>{it.t}</strong>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.55 }}>{it.d}</div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 18 }}
          onClick={onClose}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
