import Image from "next/image";
import Link from "next/link";

/** Real product routes. */
const PRODUCTS = [
  { label: "Predict FX", href: "/trade" },
  { label: "Predict WC", href: "/wc" },
  { label: "Swap FX", href: "/swap" },
  { label: "FX Markets", href: "/markets" },
  { label: "Earn", href: "/earn" },
  { label: "P2P", href: "/cash" },
  { label: "Portfolio", href: "/portfolio" },
] as const;

/** Legal links — only pages that actually exist. */
const LEGAL = [
  { label: "Terms of Service", href: "/legal/terms" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  // Risk disclosure lives in the terms page under the #risk anchor.
  { label: "Risk disclosure", href: "/legal/terms#risk" },
] as const;

/**
 * Footer — Products column links to real pages.
 * Protocol and Company columns removed: no live docs/audit/about pages exist yet.
 * Dead href="#" items removed.
 */
export function Footer() {
  return (
    <footer className="foot ds4">
      <div className="wrap">
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 30 }}>
          <div>
            <div className="logo" style={{ marginBottom: 14 }}>
              <Image
                className="mark"
                src="/brand/logo-reversed.png"
                alt={process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal"}
                width={34}
                height={34}
              />
              <span className="word" style={{ color: "#fff" }}>
                <span className="four" style={{ color: "#10d9a0" }}>
                  4
                </span>
                SIGHT
              </span>
            </div>
            <p style={{ color: "#8a94a8", maxWidth: 280, fontSize: 14, lineHeight: 1.6 }}>
              Forwards, perps, swaps, and prediction markets on emerging-market currencies.
              Self-custodial, settled onchain.
            </p>
          </div>

          <div>
            <h5>Products</h5>
            {PRODUCTS.map((p) => (
              <span key={p.href} style={{ display: "block" }}>
                <Link href={p.href}>{p.label}</Link>
              </span>
            ))}
          </div>

          <div>
            <h5>Legal</h5>
            {LEGAL.map((l) => (
              <span key={l.href} style={{ display: "block" }}>
                <Link href={l.href}>{l.label}</Link>
              </span>
            ))}
            <span className="foot-soft" style={{ marginTop: 8, display: "block" }}>
              18+ only
            </span>
          </div>
        </div>

        <style>
          {".ds4 .foot-soft{display:block;color:#aeb9cf;font-size:14px;line-height:2.1}"}
        </style>

        <div className="foot-bar">
          <span>© {new Date().getFullYear()} {process.env.NEXT_PUBLIC_APP_NAME ?? "PredFX Terminal"}</span>
          <span className="mono">
            Odds &amp; percentages reflect implied probability · Not financial advice · 18+ only
          </span>
        </div>
      </div>
    </footer>
  );
}
