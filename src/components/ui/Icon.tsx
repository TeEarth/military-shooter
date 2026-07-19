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

// v54: bumped every stop noticeably brighter/more saturated — the first pass
// read as flat/washed out on the actual buttons. Ticket flips to red (was
// green, per request — green stays reserved for Regeneration/HP-ish things).
const DEFAULT_COLORS: Record<IconName, [string, string]> = {
  coin: ["#ffe27a", "#e08a00"],
  diamond: ["#7fe0ff", "#0064e0"],
  ticket: ["#ff8a8a", "#d40000"],
  banknote: ["#8bffb8", "#00a84a"],
  play: ["#ffcf6b", "#b35400"],
  pvp: ["#ff8a6b", "#c81e0e"],
  character: ["#ffd98a", "#8a5a10"],
  inventory: ["#ffdb8a", "#a06a10"],
  gacha: ["#ffcf3a", "#c85a00"],
  trade: ["#5bffcf", "#00996a"],
  mission: ["#ff6b6b", "#b30000"],
  leaderboard: ["#ffe27a", "#e08a00"],
  mailbox: ["#7ec3ff", "#0055a0"],
  income: ["#8bffb8", "#00a84a"],
  settings: ["#e6e6ff", "#3a3a8a"],
  admin: ["#7ec3ff", "#0055a0"],
  howToPlay: ["#ffdb8a", "#a06a10"],
  spareWeapon: ["#ffb15c", "#c85a00"],
  regen: ["#7bff9a", "#00a832"],
  superShield: ["#7ec3ff", "#0055a0"],
  oneShot: ["#f0f0f0", "#5a5a5a"],
  invisible: ["#c78bff", "#5500b3"],
  neverDied: ["#ff7ab0", "#c8004a"],
  lock: ["#e6e6e6", "#4a4a4a"],
  check: ["#7bff9a", "#00a832"],
  close: ["#ff8a8a", "#c81e0e"],
  warning: ["#ffe27a", "#e08a00"],
  star: ["#ffe27a", "#e08a00"],
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
      // A soldier bust dual-wielding pistols — matches the in-game "Double
      // Pistol" identity rather than a generic play/sword icon.
      return (
        <>
          <circle cx="12" cy="7" r="3.2" fill={fill} stroke="currentColor" strokeWidth="1" />
          <path d="M6 20c0-4.4 2.4-6.8 6-6.8s6 2.4 6 6.8Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <path d="M1.6 15.6h3.6l0.9 -1.6h1v1.6h0.9v1.5H1.6Z" fill="currentColor" />
          <path d="M22.4 15.6h-3.6l-0.9 -1.6h-1v1.6h-0.9v1.5h6.4Z" fill="currentColor" />
        </>
      );
    case "pvp":
      // Two combatants facing off with "VS" between them, not an abstract
      // crosshair — reads immediately as player-vs-player.
      return (
        <>
          <circle cx="5.6" cy="7.2" r="2.6" fill={fill} stroke="currentColor" strokeWidth="1" />
          <path d="M2 19.5c0-4 1.5-6.4 3.6-6.4s3.6 2.4 3.6 6.4Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <circle cx="18.4" cy="7.2" r="2.6" fill={fill} stroke="currentColor" strokeWidth="1" />
          <path d="M14.8 19.5c0-4 1.5-6.4 3.6-6.4s3.6 2.4 3.6 6.4Z" fill={fill} stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
          <text x="12" y="15.5" fontSize="7" fontWeight="700" fill="currentColor" textAnchor="middle" fontFamily="Arial, sans-serif">VS</text>
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
      // A decorated treasure chest — banded lid, corner rivets, a locked
      // clasp — instead of a plain backpack silhouette.
      return (
        <>
          <path d="M3 10.5 5 6h14l2 4.5Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="3" y="10.5" width="18" height="9" rx="1.2" fill={fill} stroke="currentColor" strokeWidth="1.1" />
          <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.1" />
          <path d="M9 6 8 10.5M15 6l1 4.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.6" />
          <rect x="10" y="9.4" width="4" height="3.2" rx="0.7" fill="#00000055" stroke="currentColor" strokeWidth="1" />
          <circle cx="12" cy="11" r="0.7" fill="currentColor" />
          <circle cx="5.4" cy="13" r="0.7" fill="currentColor" opacity="0.7" />
          <circle cx="18.6" cy="13" r="0.7" fill="currentColor" opacity="0.7" />
          <circle cx="5.4" cy="17" r="0.7" fill="currentColor" opacity="0.7" />
          <circle cx="18.6" cy="17" r="0.7" fill="currentColor" opacity="0.7" />
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
      // v59: red/white alternating by RING (concentric circles stacked by
      // radius), not by angular half/quarter — a dartboard, not a pinwheel.
      return (
        <>
          <circle cx="11" cy="12" r="9" fill="#dc2626" stroke="currentColor" strokeWidth="1.1" />
          <circle cx="11" cy="12" r="7" fill="#f5f5f5" />
          <circle cx="11" cy="12" r="5" fill="#dc2626" />
          <circle cx="11" cy="12" r="3" fill="#f5f5f5" />
          <circle cx="11" cy="12" r="1.2" fill="#dc2626" />
          <path d="M15.5 7.5 20 3M20 3l-3.4.6M20 3l-.6 3.4" stroke={fill} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
      // A real gear — solid ring + 8 trapezoidal teeth — instead of a ring
      // with thin radiating lines that didn't actually read as a cog.
      return (
        <>
          <g fill={fill} stroke="currentColor" strokeWidth="0.8">
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(45 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(90 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(135 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(180 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(225 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(270 12 12)" />
            <rect x="10.3" y="0.7" width="3.4" height="3.3" rx="0.6" transform="rotate(315 12 12)" />
          </g>
          <circle cx="12" cy="12" r="7" fill={fill} stroke="currentColor" strokeWidth="1.2" />
          <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1" />
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
      // Assault rifle silhouette (M16A4-style: carry-handle hump up top,
      // angled magazine, pistol grip, stock) instead of the old vague blob.
      return (
        <>
          <rect x="1.6" y="10.3" width="17.4" height="2.1" rx="0.4" fill={fill} stroke="currentColor" strokeWidth="0.9" />
          <path d="M9 10.3V7.4h4.2v2.9Z" fill={fill} stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M10.3 12.4h2.6l-0.9 5.3h-2.3Z" fill={fill} stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M13.8 12.4h2v3.5h-2.7Z" fill={fill} stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <path d="M16.8 10.5h3.8v3.6h-2.6Z" fill={fill} stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="1.4" y="8.8" width="1.1" height="1.7" fill="currentColor" />
        </>
      );
    case "regen":
      // Heart with several small "+" medic crosses scattered around it, per
      // request — not just a bare heart with an EKG squiggle.
      return (
        <>
          <path d="M12 19s-6.4-4-6.4-8.8A3.8 3.8 0 0 1 12 7.4a3.8 3.8 0 0 1 6.4 2.8C18.4 15 12 19 12 19Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M9 11.6h1.4l0.6 -1.4 1 2.8 0.6 -1.4h1.4" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3.4 5.2h2.6M4.7 3.9v2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M17.6 4.4h2.3M18.75 3.25v2.3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M2 15.4h2.1M3.05 14.35v2.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          <path d="M19.8 16.6h2.1M20.85 15.55v2.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
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
      // A real skull — round cranium, deep eye sockets, jagged teeth along
      // the jaw — the old rounded-taper shape read as a lightbulb instead.
      return (
        <>
          <path d="M12 3.2c-4.6 0-7.4 3.1-7.4 6.6 0 2.2 0.9 3.6 1.8 4.7.5.6.7 1 .7 1.6v1h2v-1.4h1.1v1.4h1.6v-1.4h1.1v1.4h1.6v-1.4h1.1v1.4h2v-1c0-.6.2-1 .7-1.6.9-1.1 1.8-2.5 1.8-4.7 0-3.5-2.8-6.6-7.4-6.6Z" fill={fill} stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <ellipse cx="8.8" cy="9.7" rx="1.7" ry="2.1" fill="currentColor" />
          <ellipse cx="15.2" cy="9.7" rx="1.7" ry="2.1" fill="currentColor" />
          <path d="M12 10.6v2l-1.1 1h2.2l-1.1-1Z" fill="currentColor" opacity="0.8" />
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
  const outline = to ?? defTo;
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
      {/* v56: forces every stroke="currentColor" in the glyphs below to
          resolve to this icon's OWN dark gradient stop, instead of
          inheriting whatever (often muted/gray) text color the surrounding
          page happens to be using — that inherited-gray outline was a big
          part of why the set read as flat/washed out despite the vivid
          gradient fills. */}
      <g style={{ color: outline }}>
        <IconGlyph name={name} fill={`url(#${gradId})`} />
      </g>
    </svg>
  );
}
