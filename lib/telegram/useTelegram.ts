"use client";

/**
 * useTelegram — Telegram Mini App integration hook.
 *
 * Safe to call anywhere. When window.Telegram?.WebApp is absent (normal browser,
 * SSR) every method is a no-op and `isTelegram` is false. The non-Telegram mobile
 * web experience is completely unchanged.
 *
 * Initialisation (ready + expand) runs once on first mount from TelegramProvider.
 * Consumers call the returned helpers directly — no context needed for simple uses,
 * or wrap with TelegramProvider to share state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Telegram Web App type shim ───────────────────────────────────────────────
// The telegram-web-app.js script exposes window.Telegram.WebApp. We type the
// subset we actually use so we don't need a third-party @types package.

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface TgThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

interface TgHapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

interface TgBackButton {
  isVisible: boolean;
  show(): void;
  hide(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface TelegramWebApp {
  ready(): void;
  expand(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  themeParams: TgThemeParams;
  initData: string;
  initDataUnsafe: { user?: TgUser };
  BackButton: TgBackButton;
  HapticFeedback: TgHapticFeedback;
  colorScheme: "light" | "dark";
  version: string;
  isVersionAtLeast(version: string): boolean;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// ── Hex/RGB color allowlist ──────────────────────────────────────────────────
// Only write values that match a safe CSS color format to prevent injection of
// arbitrary strings into CSS custom properties.
const SAFE_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\))$/;

function isSafeColor(value: string): boolean {
  return SAFE_COLOR_RE.test(value.trim());
}

// ── CSS variable map ─────────────────────────────────────────────────────────
// We map a subset of Telegram's theme params to our existing design tokens.
// We intentionally DO NOT override --bg or --ink wholesale to preserve the
// light brand; we only nudge a few safe accent/muted fallbacks.
// Colors are validated before being applied — malformed values are silently ignored.

function applyTheme(params: TgThemeParams) {
  const root = document.documentElement;
  // Only set if value is present AND passes the safe-color check.
  if (params.button_color && isSafeColor(params.button_color))
    root.style.setProperty("--brand", params.button_color);
  if (params.hint_color && isSafeColor(params.hint_color))
    root.style.setProperty("--muted-2", params.hint_color);
  if (params.link_color && isSafeColor(params.link_color))
    root.style.setProperty("--link", params.link_color);
  // secondary_bg_color maps nicely to our surface/card tint
  if (params.secondary_bg_color && isSafeColor(params.secondary_bg_color))
    root.style.setProperty("--surface-tg", params.secondary_bg_color);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface TelegramHook {
  /** True when running inside the Telegram mini-app container. */
  isTelegram: boolean;
  /**
   * Raw initData string from the Telegram WebApp.
   * Use this (via the /api/telegram/auth server route) for identity verification.
   * NEVER trust initDataUnsafe directly for auth — it is client-tamperable.
   */
  initDataRaw: string;
  /** Telegram user from initDataUnsafe — for DISPLAY ONLY. Never use for identity. */
  tgUser: TgUser | undefined;
  /**
   * Show the native Telegram BackButton and wire a click handler.
   * No-op outside Telegram.
   */
  showBackButton(handler: () => void): void;
  /** Hide the native BackButton. No-op outside Telegram. */
  hideBackButton(): void;
  /**
   * Haptic impact feedback (medium by default).
   * No-op outside Telegram or on versions that don't support it.
   */
  hapticImpact(style?: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  /**
   * Haptic notification feedback.
   * No-op outside Telegram or on versions that don't support it.
   */
  hapticNotification(type?: "error" | "success" | "warning"): void;
  /** Haptic selection-changed tick. No-op outside Telegram. */
  hapticSelection(): void;
}

export function useTelegram(): TelegramHook {
  const [isTelegram, setIsTelegram] = useState(false);
  const [tgUser, setTgUser] = useState<TgUser | undefined>(undefined);
  const [initDataRaw, setInitDataRaw] = useState("");
  // Keep the current back-button click handler in a ref so we can detach it.
  const backHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const twa = window.Telegram?.WebApp;
    if (!twa) return;

    // Initialise
    twa.ready();
    twa.expand();

    // enableClosingConfirmation requires Bot API 6.2+
    if (twa.isVersionAtLeast("6.2")) {
      twa.enableClosingConfirmation();
    }

    // Apply theme with validated colors
    if (twa.themeParams) applyTheme(twa.themeParams);

    // Capture raw initData for server-side HMAC validation.
    // initDataUnsafe is used only for display (first_name, username).
    setInitDataRaw(twa.initData ?? "");
    setTgUser(twa.initDataUnsafe?.user);
    setIsTelegram(true);
  }, []);

  const showBackButton = useCallback(
    (handler: () => void) => {
      if (!isTelegram) return;
      const twa = window.Telegram?.WebApp;
      if (!twa) return;
      // BackButton requires Bot API 6.1+
      if (!twa.isVersionAtLeast("6.1")) return;
      // Detach previous handler if any
      if (backHandlerRef.current) {
        twa.BackButton.offClick(backHandlerRef.current);
      }
      backHandlerRef.current = handler;
      twa.BackButton.onClick(handler);
      twa.BackButton.show();
    },
    [isTelegram],
  );

  const hideBackButton = useCallback(() => {
    if (!isTelegram) return;
    const twa = window.Telegram?.WebApp;
    if (!twa) return;
    if (!twa.isVersionAtLeast("6.1")) return;
    if (backHandlerRef.current) {
      twa.BackButton.offClick(backHandlerRef.current);
      backHandlerRef.current = null;
    }
    twa.BackButton.hide();
  }, [isTelegram]);

  const hapticImpact = useCallback(
    (style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium") => {
      if (!isTelegram) return;
      const twa = window.Telegram?.WebApp;
      if (!twa) return;
      // HapticFeedback requires Bot API 6.1+
      if (!twa.isVersionAtLeast("6.1")) return;
      twa.HapticFeedback.impactOccurred(style);
    },
    [isTelegram],
  );

  const hapticNotification = useCallback(
    (type: "error" | "success" | "warning" = "success") => {
      if (!isTelegram) return;
      const twa = window.Telegram?.WebApp;
      if (!twa) return;
      if (!twa.isVersionAtLeast("6.1")) return;
      twa.HapticFeedback.notificationOccurred(type);
    },
    [isTelegram],
  );

  const hapticSelection = useCallback(() => {
    if (!isTelegram) return;
    const twa = window.Telegram?.WebApp;
    if (!twa) return;
    if (!twa.isVersionAtLeast("6.1")) return;
    twa.HapticFeedback.selectionChanged();
  }, [isTelegram]);

  return {
    isTelegram,
    initDataRaw,
    tgUser,
    showBackButton,
    hideBackButton,
    hapticImpact,
    hapticNotification,
    hapticSelection,
  };
}
