/** Deterministic mock orderbook generator. Replace with /book endpoint in Phase 7. */

export interface BookLevel {
  price: number;
  size: number;
  /** Cumulative size from the mid outward. */
  cumSize: number;
}

export interface Book {
  bids: BookLevel[];
  asks: BookLevel[];
  mid: number;
  spreadBps: number;
}

export function genBook(mid: number, spreadBps: number, seed = 1, depth = 14): Book {
  const halfSpread = (mid * spreadBps) / 20000;
  const tick = halfSpread * 0.4;

  let s = seed * 9301;
  function rnd(): number {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }

  const bids: BookLevel[] = [];
  const asks: BookLevel[] = [];
  let cumB = 0;
  let cumA = 0;
  for (let i = 0; i < depth; i++) {
    const bidPrice = mid - halfSpread - i * tick;
    const askPrice = mid + halfSpread + i * tick;
    const bidSize = 5000 + Math.floor(rnd() * 95000);
    const askSize = 5000 + Math.floor(rnd() * 95000);
    cumB += bidSize;
    cumA += askSize;
    bids.push({ price: bidPrice, size: bidSize, cumSize: cumB });
    asks.push({ price: askPrice, size: askSize, cumSize: cumA });
  }

  return { bids, asks, mid, spreadBps };
}

export interface RecentTrade {
  ts: number;
  side: "buy" | "sell";
  price: number;
  size: number;
}

export function genRecentTrades(mid: number, seed = 1, count = 20): RecentTrade[] {
  let s = seed * 12347;
  function rnd(): number {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  }
  const now = Date.now();
  const out: RecentTrade[] = [];
  for (let i = 0; i < count; i++) {
    const offset = (rnd() - 0.5) * mid * 0.0008;
    out.push({
      ts: now - i * 1000 * (5 + Math.floor(rnd() * 30)),
      side: rnd() > 0.5 ? "buy" : "sell",
      price: mid + offset,
      size: 1000 + Math.floor(rnd() * 25000),
    });
  }
  return out;
}
