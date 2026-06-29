import { Nav } from "@/components/shared/Nav";
import { MatchDetail } from "@/components/wc/MatchDetail";
import { WcSubnav } from "@/components/wc/WcSubnav";
import { MATCHES } from "@/lib/wc2026";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ n: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params;
  const match = MATCHES.find((m) => m.matchNumber === Number(n));
  if (!match) return { title: "Predict WC · Match" };
  return {
    title: `Predict WC · ${match.homeTeam} vs ${match.awayTeam}`,
    description: `Live World Cup 2026 match markets for ${match.homeTeam} vs ${match.awayTeam}: win, draw, totals. Real live books.`,
  };
}

export default async function MatchPage({ params }: Props) {
  const { n } = await params;
  const match = MATCHES.find((m) => m.matchNumber === Number(n));
  if (!match) notFound();

  return (
    <>
      <Nav />
      <main className="ds4">
        <WcSubnav />
        <MatchDetail match={match} />
      </main>
    </>
  );
}
