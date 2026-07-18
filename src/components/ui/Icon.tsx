"use client";

import { useId } from "react";

/**
 * Central Icon Manager — every custom UI glyph in the game (currency, main
 * menu, perks, misc actions) is registered here by name and rendered through
 * this ONE component, instead of emoji/Unicode symbols scattered across
 * every page. Swapping the whole icon set later (a new art style, a
 * seasonal theme, etc.) means editing this one file, not every page that
 * used to embed a raw emoji.
 *
 * Style: consistent tactical/military line-art — a solid accent shape plus a
 * lighter outline pass, tinted via a per-instance gradient (id'd with useId
 * so multiple copies of the same icon on one page never collide over one
 * shared <linearGradient> id). This is a hand-authored vector icon set, not
 * a 3D-rendered/photographed asset — see the project notes on why that's
 * the deliberate scope here.
 */
export type IconName =
  | "coin" | "diamond" | "ticket" | "banknote"
  | "play" | "pvp" | "character" | "inventory" | "gacha" | "trade" | "mission"
  | "leaderboard" | "mailbox" | "income" | "settings" | "admin" | "howToPlay"
  | "spareWeapon" | "regen" | "superShield" | "oneShot" | "invisible" | "neverDied"
  | "lock" | "check" | "close" | "warning" | "star" | "chevronDown" | "google";

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /** Accent gradient stops — defaults per-icon below if omitted. */
  from?: string;
  to?: string;
}

const DEFAULT_COLORS: Record<IconName, [string, string]> = {
  coin: ["#ffe08a", "#c8891a"],
  diamond: ["#8fd3ff", "#2f7fd1"],
  ticket: ["#8affa0", "#1e9c4a"],
  banknote: ["#a8f0c6", "#1f9d63"],
  play: ["#e8d9a0", "#8a6a1a"],
  pvp: ["#ff9a8a", "#a3271b"],
  character: ["#d8c9a3", "#7a6a3a"],
  inventory: ["#c9b998", "#6a5a35"],
  gacha: ["#e0b13a", "#8a6a1a"],
  trade: ["#8ae0c9", "#1a8a6a"],
  mission: ["#ff9a9a", "#a32b2b"],
  leaderboard: ["#ffe08a", "#c8891a"],
  mailbox: ["#a3c9e0", "#2a5a8a"],
  income: ["#a8f0c6", "#1f9d63"],
  settings: ["#c9c9d8", "#5a5a6a"],
  admin: ["#8fc9ff", "#2a5a9a"],
  howToPlay: ["#e0d0a3", "#8a7a3a"],
  spareWeapon: ["#d8c9a3", "#7a6a3a"],
  regen: ["#9affb0", "#1a9a3a"],
  superShield: ["#8fd0ff", "#2a6ab0"],
  oneShot: ["#ffcf8a", "#c8621a"],
  invisible: ["#c9a3ff", "#6a3ab0"],
  neverDied: ["#ff9ac2", "#c02a6a"],
  lock: ["#c9c9c9", "#6a6a6a"],
  check: ["#9affb0", "#1a9a3a"],
  close: ["#ff9a9a", "#a32b2b"],
  warning: ["#ffe08a", "#c8891a"],
  star: ["#ffe08a", "#c8891a"],
  chevronDown: ["#e0d0a3", "#8a7a3a"],
  google: ["#e8e8e8", "#8a8a8a"],
};

/** Raw path/shape content per icon, in a 0-24 viewBox. `fill` here is this
 *  instance's own unique gradient URL (never the shared literal "#g" —
 *  duplicate SVG element ids on one page resolve unpredictably in the DOM,
 *  so every icon instance gets its own id via useId() in the component
 *  below). `stroke="currentColor"` for the outline pass — callers tint that
 *  via className/color. */
function IconGlyph({ name, fill }: { name: IconName; fill: string }) {
  switch (name) {
    case "coin":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={fill} stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="6.2" fill="none" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.8" />
          <path d="M12 7.5v9M9.7 9.7h3.6a1.7 1.7 0 0 1 0 3.4H10.7a1.7 1.7 0 0 0 0 3.4h3.6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </>
      );
    case "diamond":
      return <path d="M6 4h12l4 6-10 10L2 10Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />;
    case "ticket":
      return (
        <>
          <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.2a1.6 1.6 0 0 0 0 3.2V13.5a1.6 1.6 0 0 0 0 3.2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.3a1.6 1.6 0 0 0 0-3.2V11.5a1.6 1.6 0 0 0 0-3.2Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <path d="M14 6.5v11" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1" strokeDasharray="1.6 1.6" />
        </>
      );
    case "banknote":
      return (
        <>
          <rect x="2.5" y="6.5" width="19" height="11" rx="1.6" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M5.5 9v6M18.5 9v6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        </>
      );
    case "play":
      return (
        <>
          <path d="M5 3.5 12 8l-1.6 3.2M19 3.5 12 8l1.6 3.2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8v4.5l-5.5 8h11l-5.5-8Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
        </>
      );
    case "pvp":
      return (
        <>
          <path d="M4 5 11 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M20 5 13 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4 19 11 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M20 19 13 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="12" cy="12" r="3.4" fill={fill} stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "character":
      return (
        <>
          <path d="M12 2 20 5.5v5.2c0 5-3.4 8.6-8 9.8-4.6-1.2-8-4.8-8-9.8V5.5Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2.4" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M8 16c1-2 2.4-3 4-3s3 1 4 3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </>
      );
    case "inventory":
      return (
        <>
          <rect x="4" y="8" width="16" height="12" rx="2" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <path d="M8 8V6a4 4 0 0 1 8 0v2" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <rect x="10" y="11.5" width="4" height="3" rx="0.6" fill="none" stroke="currentColor" strokeWidth="0.9" />
        </>
      );
    case "gacha":
      return (
        <>
          <path d="M4 8 12 4l8 4v9l-8 4-8-4Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M4 8 12 12l8-4M12 12v9" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </>
      );
    case "trade":
      return (
        <>
          <circle cx="12" cy="12" r="10.2" fill={fill} opacity="0.15" />
          <path d="M4 9h13M13 5l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M20 15H7M11 11l-4 4 4 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "mission":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <circle cx="12" cy="12" r="5.4" fill="none" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        </>
      );
    case "leaderboard":
      return (
        <>
          <path d="M7 4h10v6a5 5 0 0 1-10 0Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M7 6H4.5a2 2 0 0 0 0 4H6M17 6h2.5a2 2 0 0 1 0 4H16" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <path d="M10.5 15.5h3v2.2h-3zM8 20.5h8l-1-2.8H9Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
        </>
      );
    case "mailbox":
      return (
        <>
          <rect x="3" y="6" width="18" height="13" rx="1.6" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <path d="m3.5 7 8.5 6 8.5-6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "income":
      return (
        <>
          <path d="M3 7a2 2 0 0 1 2-2h11l3 3v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M16 5v3h3" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="9" cy="13.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1" />
        </>
      );
    case "settings":
      return (
        <>
          <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7 16 16M8 8 6.3 6.3" fill="none" stroke={fill} strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case "admin":
      return (
        <>
          <path d="M12 2 20 5.5v5.2c0 5-3.4 8.6-8 9.8-4.6-1.2-8-4.8-8-9.8V5.5Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="m8.5 12 2.4 2.4L15.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "howToPlay":
      return (
        <>
          <path d="M4 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v14l-6.5-3L4 19Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M9.3 9.3a2 2 0 1 1 3 1.7c-.8.5-1.3 1-1.3 2" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <circle cx="11" cy="15.3" r="0.9" fill="currentColor" />
        </>
      );
    case "spareWeapon":
      return (
        <>
          <path d="M4 13.5 5 11h9.5l1.2 1.5V15H4Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <path d="M15.5 12h3.2v2.2h-3.2zM8 15v2.5M11 15v3.2" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
        </>
      );
    case "regen":
      return (
        <>
          <path d="M12 20s-7-4.4-7-9.8A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.2C19 15.6 12 20 12 20Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M8.5 12h2l1-2 1.5 4 1-2h1.5" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "superShield":
      return (
        <>
          <path d="M12 2 20 5.5v5.2c0 5-3.4 8.6-8 9.8-4.6-1.2-8-4.8-8-9.8V5.5Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M12 6v12M8 9h8" stroke="currentColor" strokeOpacity="0.7" strokeWidth="0.9" />
        </>
      );
    case "oneShot":
      return (
        <>
          <path d="M12 3a6 6 0 0 1 6 6c0 2.6-1.4 3.9-2 5.2-.4.9-.4 1.8-.4 2.8H8.4c0-1-.0-1.9-.4-2.8C7.4 12.9 6 11.6 6 9a6 6 0 0 1 6-6Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <circle cx="9.6" cy="9" r="1.1" fill="currentColor" />
          <circle cx="14.4" cy="9" r="1.1" fill="currentColor" />
          <path d="M9 18.5h6M9.6 20.5h4.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        </>
      );
    case "invisible":
      return (
        <>
          <path d="M6 20V11a6 6 0 0 1 12 0v9l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" opacity="0.75" />
          <circle cx="9.5" cy="11" r="1" fill="currentColor" />
          <circle cx="14.5" cy="11" r="1" fill="currentColor" />
        </>
      );
    case "neverDied":
      return (
        <>
          <path d="M12 20s-7-4.4-7-9.8A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.2C19 15.6 12 20 12 20Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M7 12.5h2.4l1-2.2 1.6 4.4 1-2.2h2.6" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "lock":
      return (
        <>
          <rect x="5" y="10.5" width="14" height="9.5" rx="1.6" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="15" r="1.3" fill="currentColor" />
        </>
      );
    case "check":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={fill} stroke="currentColor" strokeWidth="1" />
          <path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      );
    case "close":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={fill} stroke="currentColor" strokeWidth="1" />
          <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </>
      );
    case "warning":
      return (
        <>
          <path d="M12 3 22 20H2Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M12 9.5v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="12" cy="16.8" r="1" fill="currentColor" />
        </>
      );
    case "star":
      return <path d="M12 2.5 14.7 9l6.8.5-5.2 4.5 1.6 6.6-6-3.6-6 3.6 1.6-6.6L2.5 9.5l6.8-.5Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />;
    case "chevronDown":
      return <path d="M5 8.5 12 15.5 19 8.5" fill="none" stroke={fill} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />;
    case "google":
      return (
        <>
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1" />
          <path d="M6 12a6 6 0 0 1 9.9-4.5l-2 1.9A3.4 3.4 0 0 0 12 8.6 3.4 3.4 0 0 0 8.7 12 3.4 3.4 0 0 0 12 15.4a3.4 3.4 0 0 0 3.2-2.2h-3.2v-2.5h5.8c.07.4.1.8.1 1.3 0 3.5-2.4 6-5.9 6A6 6 0 0 1 6 12Z" fill={fill} />
        </>
      );
    default:
      return null;
  }
}

export default function Icon({ name, size = 22, className = "", from, to }: IconProps) {
  const gradId = useId();
  const [defFrom, defTo] = DEFAULT_COLORS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from ?? defFrom} />
          <stop offset="1" stopColor={to ?? defTo} />
        </linearGradient>
      </defs>
      <IconGlyph name={name} fill={`url(#${gradId})`} />
    </svg>
  );
}
