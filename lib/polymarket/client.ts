/**
 * Server-side Polymarket CLOB client factory.
 *
 * Instantiates a ClobClient authenticated with the app's builder L2 credentials
 * (POLYMARKET_API_KEY/SECRET/PASSPHRASE -- server-side only, never sent to
 * the browser). Used for read-only operations (e.g., positions proxy).
 *
 * Order signing uses the user's wallet client-side via lib/polymarket/order.ts.
 * Builder attribution via the remote-sign route (app/api/pm/builder-sign).
 */
import "server-only";

import { Chain, ClobClient } from "@polymarket/clob-client";

const CLOB_HOST = "https://clob.polymarket.com";

function getBuilderCreds() {
  const key = process.env.POLYMARKET_API_KEY;
  const secret = process.env.POLYMARKET_API_SECRET;
  const passphrase = process.env.POLYMARKET_API_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    throw new Error("POLYMARKET_API_KEY/SECRET/PASSPHRASE not configured");
  }
  return { key, secret, passphrase };
}

/**
 * Builder-authed CLOB client (no user signer -- read-only).
 * One instance per call is fine; no connection to persist.
 */
export function makeBuilderClient(): ClobClient {
  const creds = getBuilderCreds();
  return new ClobClient(CLOB_HOST, Chain.POLYGON, undefined, creds);
}

export { CLOB_HOST };
