"use client";

/**
 * components/peer/sell/PlatformList.tsx
 *
 * Platforms section: available-platforms chip row, active PlatformCard list,
 * and the "Add another platform" dashed-button + picker dropdown.
 */

import React from "react";

import { PEER_PAYMENT_PLATFORMS } from "@/lib/peer/config";
import { PlatformCard } from "./PlatformCard";
import { techLabel } from "./primitives";
import type { PlatformEntry } from "./types";
import { newPlatformEntry } from "./types";

export function PlatformList({
  platforms,
  onUpdate,
  onRemove,
  onAdd,
}: {
  platforms: PlatformEntry[];
  onUpdate: (id: string, updated: PlatformEntry) => void;
  onRemove: (id: string) => void;
  onAdd: (platform: (typeof PEER_PAYMENT_PLATFORMS)[number]) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const usedKeys = new Set(platforms.map((e) => e.platform.key));
  const availablePlatforms = PEER_PAYMENT_PLATFORMS.filter((p) => !usedKeys.has(p.key));
  const canAdd = availablePlatforms.length > 0;

  function handleAdd(p: (typeof PEER_PAYMENT_PLATFORMS)[number]) {
    onAdd(p);
    setPickerOpen(false);
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        {techLabel(`Platforms (${platforms.length} platform${platforms.length !== 1 ? "s" : ""})`, {
          style: { marginBottom: 0 },
        })}
      </div>

      {/* available platforms — tap to add (shown above the active cards) */}
      {availablePlatforms.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontFamily: "var(--f-tech)",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
              marginBottom: 7,
            }}
          >
            Available · tap to add
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {availablePlatforms.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleAdd(p)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 11px",
                  borderRadius: 999,
                  border: "1px solid var(--line)",
                  background: "var(--bg-soft)",
                  cursor: "pointer",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    background: "var(--bg)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 800,
                  }}
                >
                  {p.displayName.slice(0, 1)}
                </span>
                {p.displayName}
                <span style={{ color: "var(--brand)", fontWeight: 800, fontSize: 13 }}>+</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* active platform cards */}
      {platforms.map((entry) => (
        <PlatformCard
          key={entry.id}
          entry={entry}
          onUpdate={(updated) => onUpdate(entry.id, updated)}
          onRemove={() => onRemove(entry.id)}
        />
      ))}

      {/* add another platform — dashed button + picker dropdown */}
      {canAdd && (
        <div style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "10px 14px",
              border: "1.5px dashed var(--line-2)",
              borderRadius: 12,
              background: "none",
              color: "var(--muted-2)",
              cursor: "pointer",
              fontFamily: "var(--f-tech)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: ".1em",
              transition: ".12s",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "1.5px solid var(--line-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                lineHeight: 1,
                color: "var(--muted-2)",
              }}
            >
              +
            </span>
            Add another platform
          </button>
          {pickerOpen && (
            <div
              style={{
                marginTop: 8,
                border: "1px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg)",
                boxShadow: "0 12px 40px rgba(0,0,0,.1)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 14px",
                  fontFamily: "var(--f-tech)",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: "var(--muted-2)",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                Choose a payment platform
              </div>
              {availablePlatforms.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => handleAdd(p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "11px 14px",
                    border: "none",
                    borderBottom: "1px solid var(--line)",
                    background: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  <span
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: "var(--bg-soft)",
                      border: "1px solid var(--line)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {p.displayName.slice(0, 1)}
                  </span>
                  <span style={{ flex: 1 }}>{p.displayName}</span>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--muted-2)",
                      fontFamily: "var(--f-tech)",
                    }}
                  >
                    {p.currencies.slice(0, 4).join(" · ")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// convenience factory re-exported for callers that need to init a fresh entry
export { newPlatformEntry };
