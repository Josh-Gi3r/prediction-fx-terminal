import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

interface Product {
  href: string;
  title: string;
  summary: string;
  features: readonly string[];
  icon: ReactNode;
  img: string;
}

const PRODUCTS: readonly Product[] = [
  {
    href: "/trade",
    title: "Deliverable Forwards",
    summary:
      "Lock today's rate, receive the currency on the delivery date. No leverage, no liquidations.",
    features: [
      "1:1 collateral, settles in the target currency",
      "Tenors from 1 day to 12 months",
      "EM corridors banks won't quote you",
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 7h14M3 13h14" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="7" cy="7" r="2.2" fill="#fff" stroke="var(--brand)" strokeWidth="1.6" />
        <circle cx="13" cy="13" r="2.2" fill="#fff" stroke="var(--brand)" strokeWidth="1.6" />
      </svg>
    ),
    img: "/brand/prod/forwards.jpg",
  },
  {
    href: "/trade?inst=differential",
    title: "Perp Differential",
    summary: "Go long or short the rate with up to 100× leverage on majors, 50× on EM pairs.",
    features: [
      "Oracle-marked, cash-settled",
      "Margin and P&L in any supported stablecoin",
      "Funding settles every 8 hours",
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M3 14l4-5 3 3 6-8"
          stroke="var(--brand)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 4v4h-4"
          stroke="var(--brand)"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    img: "/brand/prod/perps.jpg",
  },
  {
    href: "/wc",
    title: "Binary Predictions",
    summary:
      "Will France win? Will Spain reach the final? 104 World Cup 2026 matches, plus outright and award markets.",
    features: [
      "Binary YES / NO markets",
      "Resolves on the official match result",
      "Outrights, knockouts, Golden Boot and more",
    ],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="9" width="3.4" height="8" rx="1" fill="var(--brand)" />
        <rect x="8.3" y="5" width="3.4" height="12" rx="1" fill="var(--brand)" />
        <rect x="13.6" y="2.5" width="3.4" height="14.5" rx="1" fill="var(--accent-2)" />
      </svg>
    ),
    img: "/brand/prod/predictions.jpg",
  },
] as const;

/**
 * Products — transplanted from design-v2 index.html.
 * Server component — no client JS. De-branded: "one vault" / "any supported stablecoin".
 */
export function Products() {
  return (
    <section className="section" data-screen-label="Home / Products">
      <div className="wrap">
        <span className="eyebrow">
          <span className="tick" />
          Three products, one vault
        </span>
        <h2 style={{ marginTop: 14, maxWidth: 640 }}>
          Take delivery, trade with leverage, or just call yes or no.
        </h2>
        <div className="prod-grid">
          {PRODUCTS.map((p) => (
            <Link className="card card-pad prod shard" key={p.href} href={p.href}>
              <div className="prod-art">
                <div className="pico">{p.icon}</div>
                <Image
                  className="prod-img"
                  src={p.img}
                  alt=""
                  fill
                  sizes="(max-width:980px) 100vw, 33vw"
                />
              </div>
              <h3>{p.title}</h3>
              <p>{p.summary}</p>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <span className="open">
                Open
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                  <path
                    d="M3 7.5h8M7 3.5l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
