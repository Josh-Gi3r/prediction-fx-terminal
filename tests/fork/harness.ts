/**
 * tests/fork/harness.ts
 *
 * Anvil fork harness: spawn a forked chain, fund a test account, and tear
 * down cleanly at the end of each test file.
 *
 * Funding strategy: anvil_setStorageAt direct slot write.
 *
 * Why not impersonation? anvil_impersonateAccount + transferFrom from a whale
 * requires finding a whale that (a) holds enough balance, (b) has not revoked
 * self-transfer, and (c) has an unlocked nonce on the fork. This is fragile —
 * whales rotate. anvil_setStorageAt writes to the exact balances mapping slot,
 * which is deterministic for any ERC-20 with a standard mapping(address =>
 * uint256) layout.
 *
 * Slot derivation (Solidity keccak256(abi.encode(key, slot))):
 *   slot = keccak256(abi.encode(address, mappingSlot))
 * For USDC v2 / Circle FiatToken: balances mapping is at storage slot 9.
 * For USDT:                        balances mapping is at storage slot 2.
 * For USDC.e on Polygon:           same as USDC (slot 9).
 *
 * Transaction signing: anvil_impersonateAccount + eth_sendTransaction (no
 * private key required; anvil unlocks accounts on the fly). This avoids viem
 * WalletClient type gymnastics and keeps the harness dependency-light.
 */

import { execFile, spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import { http, createPublicClient, encodePacked, keccak256, pad, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, polygon } from "wagmi/chains";

const execFileAsync = promisify(execFile);

// ─── Anvil config ─────────────────────────────────────────────────────────────

export const FORK_ETH_PORT = 8546;
export const FORK_POLY_PORT = 8547;
export const FORK_ETH_URL = `http://127.0.0.1:${FORK_ETH_PORT}`;
export const FORK_POLY_URL = `http://127.0.0.1:${FORK_POLY_PORT}`;

export const ETH_FORK_RPC = "https://ethereum-rpc.publicnode.com";
export const POLY_FORK_RPC = "https://polygon-bor-rpc.publicnode.com";

// Throwaway test key. Zero funds on mainnet. Matches viem/accounts test key 0.
export const TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
export const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);
export const TEST_ADDRESS = testAccount.address; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

// ─── Well-known mainnet addresses ─────────────────────────────────────────────

/** USDC (native Circle USDC on Ethereum mainnet — EIP-2612 permit, 6 decimals). */
export const USDC_MAINNET = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;
/** USDT (Tether on Ethereum mainnet, 6 decimals, NO permit). */
export const USDT_MAINNET = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
/** USDC.e (bridged USDC on Polygon, 6 decimals, EIP-2612 permit). */
export const USDC_E_POLYGON = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;

/** Polymarket CTF Exchange on Polygon — the spender that needs USDC.e approval. */
export const CTF_EXCHANGE_POLYGON = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E" as const;

// ─── Storage slot helpers ──────────────────────────────────────────────────────

/**
 * Derive the storage slot for a mapping(address => uint256) entry.
 * keccak256(abi.encode(key, mappingSlot)) — Solidity standard layout.
 */
function balanceSlot(ownerAddress: `0x${string}`, mappingSlot: bigint): `0x${string}` {
  return keccak256(
    encodePacked(
      ["bytes32", "bytes32"],
      [
        pad(ownerAddress, { size: 32 }),
        pad(`0x${mappingSlot.toString(16)}` as `0x${string}`, { size: 32 }),
      ],
    ),
  );
}

// USDC v2 FiatToken (Ethereum mainnet): balances mapping at slot 9.
// USDT (Ethereum mainnet): balances mapping at slot 2.
// USDC.e (Polygon PoS bridge — "USD Coin (PoS)"): balances mapping at slot 0.
//   The PoS bridge contract is NOT Circle FiatToken v2; it is a separate impl
//   that stores balances in slot 0 (verified 2026-06-12 via eth_getStorageAt
//   against a known Binance Polygon holder address).
export const USDC_BALANCE_SLOT = 9n;
export const USDT_BALANCE_SLOT = 2n;
export const USDC_E_POLYGON_BALANCE_SLOT = 0n;

// ─── Spawn/kill anvil ─────────────────────────────────────────────────────────

export interface AnvilHandle {
  process: ChildProcess;
  port: number;
  url: string;
  publicClient: ReturnType<typeof createPublicClient>;
  stop: () => void;
}

/** Check anvil binary exists. Returns version string or throws. */
export async function checkAnvil(): Promise<string> {
  try {
    const { stdout } = await execFileAsync("anvil", ["--version"]);
    return stdout.trim();
  } catch {
    throw new Error(
      "anvil not found. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup",
    );
  }
}

/** Spawn an anvil fork and wait for it to be ready. */
export async function spawnAnvil(opts: {
  forkUrl: string;
  port: number;
  chainId?: number;
}): Promise<AnvilHandle> {
  const args = [
    "--fork-url",
    opts.forkUrl,
    "--port",
    String(opts.port),
    "--silent",
    // TEST_ADDRESS (viem test key 0) is one of anvil's 10 default funded+unlocked
    // accounts — no --unlocked flag needed. eth_sendTransaction works without signing.
  ];
  if (opts.chainId !== undefined) {
    args.push("--chain-id", String(opts.chainId));
  }

  const proc = spawn("anvil", args, { stdio: ["ignore", "ignore", "ignore"] });

  const url = `http://127.0.0.1:${opts.port}`;

  // Wait for anvil to be ready by polling eth_chainId
  await waitForAnvil(url, 30_000);

  const chain = opts.chainId === 137 ? polygon : mainnet;
  const transport = http(url);
  const publicClient = createPublicClient({ chain, transport });

  const stop = () => {
    try {
      proc.kill("SIGTERM");
    } catch {
      // already dead
    }
  };

  return { process: proc, port: opts.port, url, publicClient, stop };
}

async function waitForAnvil(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
      });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await sleep(200);
  }
  throw new Error(`anvil at ${url} did not become ready within ${timeoutMs}ms`);
}

// ─── RPC helpers ──────────────────────────────────────────────────────────────

export async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (data.error) throw new Error(`RPC ${method} error: ${data.error.message}`);
  return data.result;
}

// ─── Account funding ──────────────────────────────────────────────────────────

/** Give the test account ETH on the fork. */
export async function fundEth(handle: AnvilHandle, amountEth: number): Promise<void> {
  await rpcCall(handle.url, "anvil_setBalance", [
    TEST_ADDRESS,
    `0x${parseEther(String(amountEth)).toString(16)}`,
  ]);
}

/**
 * Write ERC-20 token balance directly to storage (anvil_setStorageAt).
 */
export async function setTokenBalance(
  handle: AnvilHandle,
  tokenAddr: `0x${string}`,
  mappingSlot: bigint,
  amountRaw: bigint,
): Promise<void> {
  const slot = balanceSlot(TEST_ADDRESS, mappingSlot);
  const value = `0x${amountRaw.toString(16).padStart(64, "0")}`;
  await rpcCall(handle.url, "anvil_setStorageAt", [tokenAddr, slot, value]);
}

/**
 * Fund the test account with USDC on Ethereum mainnet fork.
 * Verifies the write succeeded by reading back via balanceOf.
 */
export async function fundUsdc(handle: AnvilHandle, amountRaw: bigint): Promise<void> {
  await setTokenBalance(handle, USDC_MAINNET, USDC_BALANCE_SLOT, amountRaw);
  const balance = await readErc20Balance(handle, USDC_MAINNET, TEST_ADDRESS);
  if (balance < amountRaw) {
    throw new Error(
      `USDC funding failed: wrote ${amountRaw}, read back ${balance}. USDC may have migrated its storage layout — check slot number.`,
    );
  }
}

/** Fund the test account with USDT on Ethereum mainnet fork. */
export async function fundUsdt(handle: AnvilHandle, amountRaw: bigint): Promise<void> {
  await setTokenBalance(handle, USDT_MAINNET, USDT_BALANCE_SLOT, amountRaw);
  const balance = await readErc20Balance(handle, USDT_MAINNET, TEST_ADDRESS);
  if (balance < amountRaw) {
    throw new Error(
      `USDT funding failed: wrote ${amountRaw}, read back ${balance}. USDT storage slot may have changed.`,
    );
  }
}

/** Fund the test account with USDC.e on Polygon fork. */
export async function fundUsdcEPolygon(handle: AnvilHandle, amountRaw: bigint): Promise<void> {
  await setTokenBalance(handle, USDC_E_POLYGON, USDC_E_POLYGON_BALANCE_SLOT, amountRaw);
  const balance = await readErc20Balance(handle, USDC_E_POLYGON, TEST_ADDRESS);
  if (balance < amountRaw) {
    throw new Error(
      `USDC.e (Polygon) funding failed: wrote ${amountRaw}, read back ${balance}. USDC.e storage slot may have changed.`,
    );
  }
}

// ─── ERC-20 helpers ───────────────────────────────────────────────────────────

function encodeAddress(addr: string): string {
  return addr.slice(2).toLowerCase().padStart(64, "0");
}

const ERC20_BALANCE_OF_SELECTOR = "0x70a08231";
const ERC20_ALLOWANCE_SELECTOR = "0xdd62ed3e";

/** Read ERC-20 balanceOf via eth_call (works on any fork). */
export async function readErc20Balance(
  handle: AnvilHandle,
  token: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  const data = `${ERC20_BALANCE_OF_SELECTOR}${encodeAddress(owner)}`;
  const result = (await rpcCall(handle.url, "eth_call", [{ to: token, data }, "latest"])) as string;
  return BigInt(result);
}

/** Read ERC-20 allowance via eth_call. */
export async function readErc20Allowance(
  handle: AnvilHandle,
  token: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
): Promise<bigint> {
  const data = `${ERC20_ALLOWANCE_SELECTOR}${encodeAddress(owner)}${encodeAddress(spender)}`;
  const result = (await rpcCall(handle.url, "eth_call", [{ to: token, data }, "latest"])) as string;
  return BigInt(result);
}

// ─── Transaction helpers ──────────────────────────────────────────────────────

/**
 * Encode ERC-20 approve(spender, amount) calldata.
 * Selector: 0x095ea7b3
 */
export function encodeApprove(spender: `0x${string}`, amount: bigint): `0x${string}` {
  const sel = "095ea7b3";
  const sp = encodeAddress(spender);
  const amt = amount.toString(16).padStart(64, "0");
  return `0x${sel}${sp}${amt}`;
}

/**
 * Send a transaction from the unlocked test account via eth_sendTransaction
 * and wait for the receipt.
 *
 * Using eth_sendTransaction (not eth_sendRawTransaction) because anvil has
 * TEST_ADDRESS unlocked — no key management needed in the harness.
 */
export async function sendAndWait(
  handle: AnvilHandle,
  to: `0x${string}`,
  data: `0x${string}`,
  value = 0n,
): Promise<{ status: "success" | "reverted"; txHash: `0x${string}` }> {
  const txHash = (await rpcCall(handle.url, "eth_sendTransaction", [
    {
      from: TEST_ADDRESS,
      to,
      data,
      value: `0x${value.toString(16)}`,
      gas: "0x7A120", // 500k
    },
  ])) as `0x${string}`;

  // In fork mode, anvil queues transactions and requires an explicit evm_mine
  // to include them in a block. Call it immediately after submission.
  await rpcCall(handle.url, "evm_mine", []);

  // Poll for receipt (anvil may need a second mine for the tx to be included
  // if it was in the mempool before evm_mine fired).
  let receipt: { status: string } | null = null;
  for (let i = 0; i < 10; i++) {
    receipt = (await rpcCall(handle.url, "eth_getTransactionReceipt", [txHash])) as {
      status: string;
    } | null;
    if (receipt !== null) break;
    await sleep(100);
    await rpcCall(handle.url, "evm_mine", []);
  }

  const status = receipt?.status === "0x1" ? "success" : "reverted";
  return { status, txHash };
}

/**
 * Simulate a transaction via eth_call and check for revert.
 */
export async function simulateTx(
  handle: AnvilHandle,
  from: `0x${string}`,
  to: `0x${string}`,
  data: `0x${string}`,
  value = 0n,
): Promise<{ willRevert: boolean; revertReason: string }> {
  try {
    await rpcCall(handle.url, "eth_call", [
      {
        from,
        to,
        data,
        value: `0x${value.toString(16)}`,
        gas: "0x7A120",
      },
      "latest",
    ]);
    return { willRevert: false, revertReason: "" };
  } catch (e) {
    return { willRevert: true, revertReason: (e as Error).message ?? "unknown revert" };
  }
}

// ─── Network availability check ───────────────────────────────────────────────

/** Returns true if the given URL responds to eth_blockNumber. */
export async function isRpcReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { result?: string };
    return typeof data.result === "string";
  } catch {
    return false;
  }
}

/** Get bytecode at address. */
export async function getCode(handle: AnvilHandle, address: `0x${string}`): Promise<string> {
  return (await rpcCall(handle.url, "eth_getCode", [address, "latest"])) as string;
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
