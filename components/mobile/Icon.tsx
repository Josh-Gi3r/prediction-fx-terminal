"use client";

interface IconProps {
  name: string;
  size?: number;
  stroke?: number;
  color?: string;
}

export function Icon({ name, size = 22, stroke = 2, color = "currentColor" }: IconProps) {
  const p = {
    fill: "none" as const,
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" {...p} />
        <path d="M5.5 9.5V20h13V9.5" {...p} />
      </>
    ),
    cup: (
      <>
        <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" {...p} />
        <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" {...p} />
        <path d="M12 13v4M9 21h6M10 19h4" {...p} />
      </>
    ),
    trade: (
      <>
        <path d="M4 18V6M4 18h16" {...p} />
        <rect x="7" y="11" width="3" height="5" rx="1" {...p} />
        <rect x="13" y="7" width="3" height="9" rx="1" {...p} />
      </>
    ),
    markets: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" {...p} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...p} />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" {...p} />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" {...p} />
      </>
    ),
    wallet: (
      <>
        <rect x="3" y="6" width="18" height="13" rx="3" {...p} />
        <path d="M3 9h18M16.5 13h1.5" {...p} />
      </>
    ),
    bell: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" {...p} />
        <path d="M10 19a2 2 0 0 0 4 0" {...p} />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" {...p} />
        <path d="m20 20-3.2-3.2" {...p} />
      </>
    ),
    arrow: <path d="M4 12h14M13 6l6 6-6 6" {...p} />,
    back: <path d="M15 5l-7 7 7 7" {...p} />,
    chevron: <path d="M9 6l6 6-6 6" {...p} />,
    plus: <path d="M12 5v14M5 12h14" {...p} />,
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" {...p} />,
    swap: (
      <>
        <path d="M7 4 4 7l3 3M4 7h13" {...p} />
        <path d="m17 20 3-3-3-3M20 17H7" {...p} />
      </>
    ),
    forward: (
      <>
        <path d="M5 12h12M11 6l6 6-6 6" {...p} />
        <circle cx="20" cy="12" r="1.4" fill={color} stroke="none" />
      </>
    ),
    check: <path d="M5 13l4 4L19 7" {...p} />,
    "fx-provider": (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" {...p} />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <path d="M12 7v5l3.5 2" {...p} />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" {...p} />
        <circle cx="12" cy="10" r="2.3" {...p} />
      </>
    ),
    star: (
      <path d="m12 3 2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.9 6.6 19.4l1.2-6L3.4 9.3l6-.7L12 3Z" {...p} />
    ),
    filter: <path d="M4 6h16M7 12h10M10 18h4" {...p} />,
    info: (
      <>
        <circle cx="12" cy="12" r="8.5" {...p} />
        <path d="M12 11v5M12 8v.1" {...p} />
      </>
    ),
    share: (
      <>
        <path d="M12 3v12M8 7l4-4 4 4" {...p} />
        <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" {...p} />
      </>
    ),
    refresh: (
      <>
        <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5" {...p} />
        <path d="M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5" {...p} />
      </>
    ),
    cash: (
      <>
        <rect x="2.5" y="6.5" width="19" height="11.5" rx="2.5" {...p} />
        <circle cx="12" cy="12.2" r="2.6" {...p} />
        <path d="M6 9.6h.01M18 14.8h.01" {...p} />
      </>
    ),
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name] ?? null}
    </svg>
  );
}
