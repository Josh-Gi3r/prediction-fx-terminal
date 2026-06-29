// Aave v3 Ethereum mainnet — supply/withdraw stablecoins, earn live APY.
// Pool address verified against the published deployment (aave.com/docs).

import { ETH_TOKENS } from "@/lib/chains/tokens";

export const AAVE_V3_MAINNET = {
  Pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
  PoolAddressesProvider: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
} as const;

// Stablecoin underlying addresses + Aave's aToken on v3 (canonical, fetched via
// Pool.getReserveData but pinned here so the UI can render without an RPC roundtrip).
// aToken balance accrues interest in real time (rebasing — balanceOf grows).
export const AAVE_RESERVES: Record<
  string,
  { symbol: string; underlying: `0x${string}`; aToken: `0x${string}`; decimals: number }
> = {
  USDC: {
    symbol: "USDC",
    underlying: ETH_TOKENS.USDC,
    aToken: "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c",
    decimals: 6,
  },
  USDT: {
    symbol: "USDT",
    underlying: ETH_TOKENS.USDT,
    aToken: "0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a",
    decimals: 6,
  },
  DAI: {
    symbol: "DAI",
    underlying: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    aToken: "0x018008bfb33d285247A21d44E50697654f754e63",
    decimals: 18,
  },
  USDS: {
    symbol: "USDS",
    underlying: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
    aToken: "0x32A6268f9Ba3642Dda7892aDd74f1D34469A4259",
    decimals: 18,
  },
  PYUSD: {
    symbol: "PYUSD",
    underlying: "0x6c3ea9036406852006290770BEdFcAbA0e23A0e8",
    aToken: "0x0C0d01AbF3e6aDfcA0989eBbA9d6e85dD58EaB1E",
    decimals: 6,
  },
  GHO: {
    symbol: "GHO",
    underlying: "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f",
    aToken: "0x00907f9921424583e7ffBfEdf84F92B7B2Be4977",
    decimals: 18,
  },
  USDe: {
    symbol: "USDe",
    underlying: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
    aToken: "0x4F5923Fc5FD4a93352581b38B7cD26943012DECF",
    decimals: 18,
  },
};

// Minimal ABI — only what we use.
export const POOL_ABI = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        components: [
          {
            name: "configuration",
            type: "tuple",
            components: [{ name: "data", type: "uint256" }],
          },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

/** Aave returns currentLiquidityRate in RAY (10^27). Annualised supply APY %. */
export function rayToApyPct(ray: bigint): number {
  return (Number(ray) / 1e27) * 100;
}
