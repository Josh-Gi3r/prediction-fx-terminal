/**
 * Server-side Telegram initData HMAC validation.
 *
 * Implements the algorithm from https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Key derivation:
 *   secret_key = HMAC-SHA256(key="WebAppData", data=BOT_TOKEN)
 *   check_hash = HMAC-SHA256(key=secret_key, data=data_check_string)
 *
 * where data_check_string is all key=value pairs (excluding "hash") sorted
 * alphabetically and joined by newlines.
 *
 * SECURITY NOTES:
 * - This runs server-side ONLY. Never call from browser code.
 * - Uses timing-safe comparison (timingSafeEqual) to prevent timing attacks.
 * - auth_date staleness check defaults to 24 hours.
 */

import crypto from "node:crypto";

export interface ValidatedTgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface ValidatedInitData {
  user?: ValidatedTgUser;
  query_id?: string;
  auth_date: number;
  chat_instance?: string;
  chat_type?: string;
  start_param?: string;
}

export type ValidationResult = { ok: true; data: ValidatedInitData } | { ok: false; error: string };

/** Max age for auth_date before we consider the initData stale. Default: 24 h */
const MAX_AGE_SECONDS = 86_400;

export function validateTelegramInitData(
  rawInitData: string,
  botToken: string,
  maxAgeSeconds = MAX_AGE_SECONDS,
): ValidationResult {
  if (!rawInitData) return { ok: false, error: "empty initData" };
  if (!botToken) return { ok: false, error: "bot token not configured" };

  // Parse the URL-encoded string into a map
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(rawInitData);
  } catch {
    return { ok: false, error: "failed to parse initData" };
  }

  const receivedHash = params.get("hash");
  if (!receivedHash) return { ok: false, error: "missing hash field" };

  // Build data-check-string: all fields except "hash", sorted alphabetically
  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key !== "hash") {
      entries.push(`${key}=${value}`);
    }
  }
  entries.sort();
  const dataCheckString = entries.join("\n");

  // Derive secret key: HMAC-SHA256("WebAppData", botToken)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  // Compute expected hash
  const expectedHashBuffer = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest();

  // Timing-safe comparison
  let receivedHashBuffer: Buffer;
  try {
    receivedHashBuffer = Buffer.from(receivedHash, "hex");
  } catch {
    return { ok: false, error: "invalid hash encoding" };
  }

  if (expectedHashBuffer.length !== receivedHashBuffer.length) {
    return { ok: false, error: "hash length mismatch" };
  }

  const hashesMatch = crypto.timingSafeEqual(expectedHashBuffer, receivedHashBuffer);
  if (!hashesMatch) {
    return { ok: false, error: "hash mismatch — data integrity check failed" };
  }

  // Staleness check
  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) return { ok: false, error: "missing auth_date" };
  const authDate = Number.parseInt(authDateRaw, 10);
  if (Number.isNaN(authDate)) return { ok: false, error: "invalid auth_date" };
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > maxAgeSeconds) {
    return { ok: false, error: `auth_date too old (${now - authDate}s > ${maxAgeSeconds}s)` };
  }

  // Parse the user field
  let user: ValidatedTgUser | undefined;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as ValidatedTgUser;
    } catch {
      return { ok: false, error: "failed to parse user field" };
    }
  }

  return {
    ok: true,
    data: {
      user,
      query_id: params.get("query_id") ?? undefined,
      auth_date: authDate,
      chat_instance: params.get("chat_instance") ?? undefined,
      chat_type: params.get("chat_type") ?? undefined,
      start_param: params.get("start_param") ?? undefined,
    },
  };
}
