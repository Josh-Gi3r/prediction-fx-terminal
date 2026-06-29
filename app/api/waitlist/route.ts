/**
 * POST /api/waitlist
 *
 * Accepts { email, product } and logs the signup.
 * Optional: set WAITLIST_LOG_PATH env var to an absolute path for a file store.
 * Without it, entries are logged to stdout only (suitable for Railway log capture).
 *
 * Body schema: { email: string; product: string }
 * Returns: 202 { ok: true } on success, 400 on bad input.
 */

import { appendFileSync } from "node:fs";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { email, product } = body as Record<string, unknown>;

  if (typeof email !== "string" || !isValidEmail(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const productStr = typeof product === "string" ? product.slice(0, 80) : "unknown";
  const entry = {
    ts: new Date().toISOString(),
    email: email.toLowerCase().trim(),
    product: productStr,
  };

  // Log to stdout — Railway captures this in project logs.
  console.log("[waitlist]", JSON.stringify(entry));

  // Optional append-only file store. Ignored if path not set or write fails.
  const logPath = process.env.WAITLIST_LOG_PATH;
  if (logPath) {
    try {
      appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err) {
      console.error("[waitlist] file write failed:", err);
    }
  }

  return NextResponse.json({ ok: true }, { status: 202 });
}
