/**
 * lib/telegram/openExternal.ts
 *
 * TG-safe external link opener.
 *
 * - Inside Telegram Mini App: calls Telegram.WebApp.openLink(url) so the URL
 *   opens in an in-app browser instead of breaking the mini-app context.
 * - Outside Telegram (normal browser / SSR): falls back to window.open.
 *
 * Usage:
 *   import { openExternal } from "@/lib/telegram/openExternal";
 *   openExternal("https://etherscan.io/tx/0xabc...");
 *
 * Replaces raw <a target="_blank"> in mobile components where the Telegram
 * WebView would otherwise navigate the entire mini-app away.
 */

export function openExternal(url: string): void {
  if (typeof window === "undefined") return;

  // Telegram.WebApp.openLink is available when running inside a mini-app.
  const tgOpenLink = (
    window as Window & { Telegram?: { WebApp?: { openLink?: (url: string) => void } } }
  ).Telegram?.WebApp?.openLink;

  if (typeof tgOpenLink === "function") {
    tgOpenLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
