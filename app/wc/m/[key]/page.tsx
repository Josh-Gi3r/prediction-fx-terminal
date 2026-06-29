import { Nav } from "@/components/shared/Nav";
import { MarketDetail } from "@/components/wc/MarketDetail";
import { WcSubnav } from "@/components/wc/WcSubnav";
import type { Metadata } from "next";
import Link from "next/link";

interface Props {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { key } = await params;
  const decoded = decodeURIComponent(key);
  return {
    title: "Predict WC · Market",
    description: `Live order book and trading for World Cup 2026 market ${decoded}.`,
  };
}

export default async function MarketPage({ params }: Props) {
  const { key } = await params;
  // Next.js 15 dynamic segments with colons may be returned URL-encoded from params.
  const marketKey = decodeURIComponent(key);

  return (
    <>
      <Nav />
      <main className="ds4">
        <WcSubnav />

        {/* dt-hdr — matches wc-market.html header style */}
        <header className="dt-hdr" aria-label="Market header">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/wc">Predict WC</Link>
              <span className="sep">/</span>
              <Link href="/wc/props">Specials</Link>
              <span className="sep">/</span>
              <b>Market</b>
            </nav>
          </div>
        </header>

        <MarketDetail marketKey={marketKey} />
      </main>
    </>
  );
}
