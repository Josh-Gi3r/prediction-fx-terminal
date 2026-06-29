"use client";

import { useMemo } from "react";
import { erc20Abi } from "viem";
import { useReadContracts } from "wagmi";
import { AAVE_RESERVES, AAVE_V3_MAINNET, POOL_ABI, rayToApyPct } from "./aave";

const reserves = Object.values(AAVE_RESERVES);

export interface AaveReserveLive {
  symbol: string;
  underlying: `0x${string}`;
  aToken: `0x${string}`;
  decimals: number;
  apyPct: number; // 0 if unread
}

/** Live supply APY for every reserve via Pool.getReserveData multicall.
 *  Reads currentLiquidityRate (ray) → APY %. */
export function useAaveReserves() {
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: reserves.map((r) => ({
      address: AAVE_V3_MAINNET.Pool as `0x${string}`,
      abi: POOL_ABI,
      functionName: "getReserveData" as const,
      args: [r.underlying],
      // Pin to mainnet: Aave's APY must not depend on which chain the
      // user's wallet happens to be on (unpinned reads followed the wallet
      // chain and silently failed to 0 on Base/Sepolia).
      chainId: 1,
    })),
    query: { refetchInterval: 60_000 },
  });

  const live: AaveReserveLive[] = useMemo(
    () =>
      reserves.map((r, i) => {
        const res = data?.[i];
        if (res?.status !== "success") return { ...r, apyPct: 0 };
        const out = res.result as { currentLiquidityRate?: bigint };
        return {
          ...r,
          apyPct: out.currentLiquidityRate ? rayToApyPct(out.currentLiquidityRate) : 0,
        };
      }),
    [data],
  );
  return { reserves: live, isLoading };
}

/** aToken balances per reserve. aToken balance includes accrued interest live. */
export function useAaveBalances(owner?: `0x${string}`) {
  const { data, isLoading } = useReadContracts({
    allowFailure: true,
    contracts: reserves.map((r) => ({
      address: r.aToken,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [owner as `0x${string}`],
    })),
    query: { enabled: !!owner, refetchInterval: 30_000 },
  });

  const balances: Record<string, bigint> = useMemo(() => {
    const m: Record<string, bigint> = {};
    reserves.forEach((r, i) => {
      const v = data?.[i];
      if (v?.status === "success" && typeof v.result === "bigint") m[r.symbol] = v.result;
    });
    return m;
  }, [data]);

  return { balances, isLoading };
}
