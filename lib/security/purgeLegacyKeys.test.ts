import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { purgeLegacyApiKeys } from "./purgeLegacyKeys";

// Minimal localStorage stub for the node test environment.
function makeStorage(): Storage {
  const store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number): string | null {
      return Object.keys(store)[index] ?? null;
    },
    getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(store, key) ? (store[key] as string) : null;
    },
    setItem(key: string, value: string): void {
      store[key] = value;
    },
    removeItem(key: string): void {
      delete store[key];
    },
    clear(): void {
      for (const k of Object.keys(store)) delete store[k];
    },
  };
}

let originalWindow: (Window & typeof globalThis) | undefined;

beforeEach(() => {
  // Inject a window-like global so the SSR guard passes.
  originalWindow = (globalThis as Record<string, unknown>).window as
    | (Window & typeof globalThis)
    | undefined;
  const storage = makeStorage();
  (globalThis as Record<string, unknown>).window = { localStorage: storage };
});

afterEach(() => {
  if (originalWindow === undefined) {
    (globalThis as Record<string, unknown>).window = undefined;
  } else {
    (globalThis as Record<string, unknown>).window = originalWindow;
  }
});

describe("purgeLegacyApiKeys", () => {
  it("removes keys with the app.apikey. prefix", () => {
    const ls = (globalThis as Record<string, unknown> & { window: { localStorage: Storage } })
      .window.localStorage;
    ls.setItem("app.apikey.0xabc", JSON.stringify({ apiKey: "k", apiSecret: "s" }));
    ls.setItem("unrelated.key", "keep-me");

    purgeLegacyApiKeys();

    expect(ls.getItem("app.apikey.0xabc")).toBeNull();
    expect(ls.getItem("unrelated.key")).toBe("keep-me");
  });

  it("is idempotent — calling twice does not throw", () => {
    const ls = (globalThis as Record<string, unknown> & { window: { localStorage: Storage } })
      .window.localStorage;
    ls.setItem("app.apikey.0xdef", "{}");

    expect(() => {
      purgeLegacyApiKeys();
      purgeLegacyApiKeys();
    }).not.toThrow();
  });

  it("does not throw when localStorage is empty", () => {
    expect(() => purgeLegacyApiKeys()).not.toThrow();
  });

  it("is a no-op when window is undefined (SSR)", () => {
    (globalThis as Record<string, unknown>).window = undefined;
    expect(() => purgeLegacyApiKeys()).not.toThrow();
    // Restore for afterEach to clean up properly.
    (globalThis as Record<string, unknown>).window = { localStorage: makeStorage() };
  });
});
