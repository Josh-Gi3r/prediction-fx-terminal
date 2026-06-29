/**
 * lib/db/client.ts
 *
 * Singleton postgres-js client.
 *
 * Lazy-connect design: the sql tagged-template is created on first import but
 * will only open connections when a query is actually executed.  When
 * DATABASE_URL is absent (local dev, unit tests) every query rejects with a
 * clear "no DATABASE_URL" error rather than crashing at module-load time.
 */

import "server-only";
import postgres from "postgres";

let _sql: ReturnType<typeof postgres> | null = null;

function getClient(): ReturnType<typeof postgres> {
  if (_sql) return _sql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Return a proxy that throws clearly instead of crashing at import.
    throw new Error("[db] DATABASE_URL is not set — cannot connect to Postgres");
  }

  _sql = postgres(url, {
    max: 5, // single-replica; keep pool small
    idle_timeout: 30,
    connect_timeout: 10,
    ssl: "require",
  });

  return _sql;
}

/**
 * Tagged-template SQL helper.  Lazy: opening a connection happens on first
 * query execution, not at import.  Safe to import in modules that only run
 * when DATABASE_URL is set (server routes, migrate script).
 */
export const sql: ReturnType<typeof postgres> = new Proxy({} as ReturnType<typeof postgres>, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
  apply(_target, _thisArg, args) {
    return (getClient() as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as unknown as ReturnType<typeof postgres>;

// Allow callers to end the pool cleanly (used by migrate script).
export async function endPool(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
