/**
 * scripts/migrate.mjs
 *
 * Idempotent database migrator.
 *
 * - Creates schema_migrations table on first run.
 * - Applies any db/migrations/*.sql files not yet recorded, in filename order.
 * - Each migration runs inside its own transaction so a failure is atomic.
 * - Safe to re-run: already-applied versions are skipped.
 * - If DATABASE_URL is unset, logs a warning and exits 0 (local dev / CI).
 *
 * Invoked at deploy start (before `next start`) via railway.toml startCommand.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "db", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[migrate] DATABASE_URL not set — skipping migrations (local/CI).");
    process.exit(0);
  }

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 10,
    connect_timeout: 15,
    ssl: "require",
    onnotice: () => {}, // suppress NOTICE from IF NOT EXISTS
  });

  try {
    // Ensure tracking table exists.
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version    TEXT        PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;

    // Read applied versions.
    const rows = await sql`SELECT version FROM schema_migrations`;
    const applied = new Set(rows.map((r) => r.version));

    // Collect .sql files in filename order.
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrate] skip  ${file} (already applied)`);
        continue;
      }

      const filePath = join(MIGRATIONS_DIR, file);
      const content = await readFile(filePath, "utf8");

      console.log(`[migrate] apply ${file} …`);

      // Each migration in its own transaction.
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`
          INSERT INTO schema_migrations (version) VALUES (${file})
        `;
      });

      console.log(`[migrate] done  ${file}`);
      ran++;
    }

    if (ran === 0) {
      console.log("[migrate] nothing to apply — schema is up to date.");
    } else {
      console.log(`[migrate] applied ${ran} migration(s).`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("[migrate] FATAL:", err);
  process.exit(1);
});
