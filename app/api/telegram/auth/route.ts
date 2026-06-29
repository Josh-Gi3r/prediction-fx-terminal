/**
 * POST /api/telegram/auth
 *
 * Validates Telegram Mini App initData and returns the verified user payload.
 *
 * Request body (JSON): { initData: string }
 *   initData — the raw URL-encoded string from window.Telegram.WebApp.initData
 *              (NOT initDataUnsafe, which is client-tamperable)
 *
 * Response 200: { ok: true, user: ValidatedTgUser, auth_date: number }
 * Response 400: { ok: false, error: string }
 * Response 500: { ok: false, error: string }
 *
 * SECURITY:
 * - TELEGRAM_BOT_TOKEN is a server-only env var (no NEXT_PUBLIC_ prefix).
 * - HMAC-SHA256 with timing-safe comparison — immune to timing attacks.
 * - auth_date staleness check: rejects data older than 24 h.
 * - If TELEGRAM_BOT_TOKEN is not set, the route returns 500 — this prevents
 *   silent accept on misconfigured deploys.
 */

import { validateTelegramInitData } from "@/lib/telegram/validateInitData";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Guard: bot token must be configured server-side
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!botToken) {
    console.error("[telegram/auth] TELEGRAM_BOT_TOKEN is not set");
    return NextResponse.json(
      { ok: false, error: "Telegram login is not configured on this server" },
      { status: 500 },
    );
  }

  let body: { initData?: unknown };
  try {
    body = (await request.json()) as { initData?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid request body" }, { status: 400 });
  }

  const initData = typeof body.initData === "string" ? body.initData : "";
  if (!initData) {
    return NextResponse.json({ ok: false, error: "initData is required" }, { status: 400 });
  }

  const result = validateTelegramInitData(initData, botToken);

  if (!result.ok) {
    // Don't leak detailed error to the client in production; log server-side.
    console.warn("[telegram/auth] validation failed:", result.error);
    return NextResponse.json(
      { ok: false, error: "Telegram identity verification failed" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user: result.data.user,
      auth_date: result.data.auth_date,
      query_id: result.data.query_id,
    },
    { status: 200 },
  );
}
