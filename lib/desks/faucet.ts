// FX provider testnet faucet (IssueTestTokenV3). claimTo(address) mints all 117 mock
// tokens (1B each) in one tx. ~0.056 ETH gas; one claim per address; ~5s keeper
// delay before balances appear. Token mint() is owner-only — must use the faucet.
export const FAUCET_ADDRESS = "0x4FAc3BB8B77547E2Da7ed903baDBeD2f46cBe65a" as const;

export const FAUCET_ABI = [
  {
    type: "function",
    name: "claimTo",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }],
    outputs: [],
  },
] as const;
