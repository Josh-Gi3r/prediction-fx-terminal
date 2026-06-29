"use client";

import { teamCardSrc } from "@/lib/wc2026/teamCard";
import Image from "next/image";
import { Icon } from "./Icon";

// ── Logo ──────────────────────────────────────────────────────────────────────
export function MobileLogo({ dark = false, size = 22 }: { dark?: boolean; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Image
        src="/brand/logo.png"
        alt=""
        width={size + 6}
        height={size + 6}
        style={{ display: "block" }}
      />
      <span
        style={{
          fontFamily: "var(--f-display)",
          fontWeight: 700,
          fontStyle: "italic",
          fontSize: size,
          letterSpacing: ".01em",
          color: dark ? "#fff" : "var(--ink)",
        }}
      >
        <span style={{ color: "var(--brand)" }}>4</span>SIGHT
      </span>
    </span>
  );
}

// ── Flag (flagcdn) ────────────────────────────────────────────────────────────
const FLAGMAP: Record<string, string> = {
  FRA: "fr",
  ESP: "es",
  ENG: "gb-eng",
  BRA: "br",
  ARG: "ar",
  POR: "pt",
  GER: "de",
  NED: "nl",
  NOR: "no",
  BEL: "be",
  COL: "co",
  URU: "uy",
  MEX: "mx",
  USA: "us",
  SUI: "ch",
  ECU: "ec",
  MAR: "ma",
  JPN: "jp",
  CRO: "hr",
  SEN: "sn",
  AUT: "at",
  KOR: "kr",
  SKO: "kr",
  GHA: "gh",
  CIV: "ci",
  EGY: "eg",
  TUR: "tr",
  CAN: "ca",
  ALG: "dz",
  AUS: "au",
  SCO: "gb-sct",
  PAR: "py",
  SWE: "se",
  IRN: "ir",
  KSA: "sa",
  UZB: "uz",
  CPV: "cv",
  COD: "cd",
  NZL: "nz",
  TUN: "tn",
  BIH: "ba",
  RSA: "za",
  QAT: "qa",
  HAI: "ht",
  JOR: "jo",
  IRQ: "iq",
  PAN: "pa",
  CUW: "cw",
  CUR: "cw",
  CZE: "cz",
};

export function flagSrc(code: string): string {
  const iso = FLAGMAP[code];
  return iso ? `https://flagcdn.com/w80/${iso}.png` : "";
}

export function Flag({ code, size = 26 }: { code: string; size?: number }) {
  const src = flagSrc(code);
  if (!src) return <span className="flagc">{code}</span>;
  return (
    <img className="flag-img" src={src} alt={code} style={{ width: size, height: size * 0.72 }} />
  );
}

// ── Team card image ───────────────────────────────────────────────────────────

export function cardSrc(name: string): string {
  return teamCardSrc(name) ?? "";
}

export function codeOf(oddsStr: string): string {
  return (oddsStr || "").split(" ")[0] ?? "";
}

// ── Disclaimer ────────────────────────────────────────────────────────────────
export function Disclaimer({ dark = false }: { dark?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        margin: "20px 18px 6px",
        color: dark ? "#7f90b0" : "var(--muted-2)",
        fontSize: 11.5,
        lineHeight: 1.5,
      }}
    >
      <Icon name="info" size={14} color={dark ? "#7f90b0" : "var(--muted-2)"} />
      <span>
        Odds &amp; percentages reflect implied probability. Not financial advice. 18+ only. Play
        responsibly.
      </span>
    </div>
  );
}

// ── Featured immersive match card ─────────────────────────────────────────────
interface MatchLike {
  h: string;
  a: string;
  hc: string;
  ac: string;
  ph: number;
  pd: number;
  pa: number;
  ho?: string;
  ao?: string;
  cd?: string;
  time?: string;
  date?: string;
  round?: string;
  n?: number;
  venue?: string;
  ou?: string;
  dr?: string;
  vol?: string;
  traders?: string;
  liq?: string;
  hc3?: string;
  ac3?: string;
}

export function FeaturedCard({
  m,
  onClick,
}: {
  m: MatchLike;
  onClick: () => void;
}) {
  const hl = cardSrc(m.h);
  const al = cardSrc(m.a);
  return (
    <div
      className="fcard fade-in"
      style={{ "--hc": m.hc, "--ac": m.ac } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="side l">
        <div className="glow" />
      </div>
      <div className="side r">
        <div className="glow" />
      </div>
      {hl && <img className="cimg l" src={hl} alt="" />}
      {al && <img className="cimg r" src={al} alt="" />}
      <div className="scrim" />
      <div className="fbody">
        <div className="ftop">
          <span className="badge-live">
            <span className="dot-live" />
            Featured
          </span>
          <span>{m.round}</span>
        </div>
        <div className="fteams">
          <div>
            <div className="nm">{m.h}</div>
            <div className="wp h">{m.ph}%</div>
          </div>
          <div className="mid">
            <div className="cd">{m.cd || m.time}</div>
            <div className="cdl">{m.cd ? "STARTS IN" : (m.date ?? "").toUpperCase()}</div>
          </div>
          <div>
            <div className="nm">{m.a}</div>
            <div className="wp a">{m.pa}%</div>
          </div>
        </div>
        <div className="pbar">
          <i className="h" style={{ width: `${m.ph}%` }} />
          <i className="d" style={{ width: `${m.pd}%` }} />
          <i className="a" style={{ width: `${m.pa}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Compact match card (scroller) ─────────────────────────────────────────────
export function MatchCardCompact({
  m,
  onClick,
}: {
  m: MatchLike;
  onClick: () => void;
}) {
  const hl = cardSrc(m.h);
  const al = cardSrc(m.a);
  return (
    <div
      className="mcardc"
      style={{ "--hc": m.hc, "--ac": m.ac } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="side l">
        <div className="glow" />
      </div>
      <div className="side r">
        <div className="glow" />
      </div>
      {hl && <img className="cimg l" src={hl} alt="" />}
      {al && <img className="cimg r" src={al} alt="" />}
      <div className="scrim" />
      <div className="cbody">
        <div className="ctop">
          <span>#{String(m.n ?? 0).padStart(3, "0")}</span>
          <span>{(m.date ?? "").toUpperCase()}</span>
        </div>
        <div className="cteams">
          <div>
            <div className="tn">{m.h}</div>
            <div className="wp h">{m.ph}%</div>
          </div>
          <div className="vs">VS</div>
          <div>
            <div className="tn">{m.a}</div>
            <div className="wp a">{m.pa}%</div>
          </div>
        </div>
        <div className="pbar">
          <i className="h" style={{ width: `${m.ph}%` }} />
          <i className="d" style={{ width: `${m.pd}%` }} />
          <i className="a" style={{ width: `${m.pa}%` }} />
        </div>
      </div>
    </div>
  );
}

// ── Full match card ───────────────────────────────────────────────────────────
export function MatchCardFull({
  m,
  onClick,
}: {
  m: MatchLike;
  onClick: () => void;
}) {
  const hl = cardSrc(m.h);
  const al = cardSrc(m.a);
  return (
    <div
      className="mcf"
      style={{ "--hc": m.hc, "--ac": m.ac } as React.CSSProperties}
      onClick={onClick}
    >
      <div className="side l">
        <div className="glow" />
      </div>
      <div className="side r">
        <div className="glow" />
      </div>
      {hl && <img className="cimg l" src={hl} alt="" />}
      {al && <img className="cimg r" src={al} alt="" />}
      <div className="scrim" />
      <div className="cbody">
        <div className="ctop">
          <span>
            #{String(m.n ?? 0).padStart(3, "0")} · {m.round}
          </span>
          <span>{(m.date ?? "").toUpperCase()}</span>
        </div>
        <div className="cteams">
          <div>
            <div className="tn">{m.h}</div>
            {m.ho && <div className="od h">{m.ho}</div>}
            <div className="wp h">{m.ph}%</div>
          </div>
          <div className="vs">VS</div>
          <div>
            <div className="tn">{m.a}</div>
            {m.ao && <div className="od a">{m.ao}</div>}
            <div className="wp a">{m.pa}%</div>
          </div>
        </div>
        <div className="pbar">
          <i className="h" style={{ width: `${m.ph}%` }} />
          <i className="d" style={{ width: `${m.pd}%` }} />
          <i className="a" style={{ width: `${m.pa}%` }} />
        </div>
        {m.dr && (
          <div className="drawl">
            Draw {m.dr} · {m.pd}%
          </div>
        )}
        {m.venue && (
          <div className="mcf-foot">
            <span>📍 {m.venue}</span>
            {m.ou && <span className="ou">O/U {m.ou}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
