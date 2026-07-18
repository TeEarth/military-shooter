"use client";

import { useEffect } from "react";
import Link from "next/link";
import CurrencyBar from "@/components/ui/CurrencyBar";
import { sfx } from "@/lib/sfx";
import { getWeaponSprite } from "@/lib/spriteHelpers";
import { SKIN_COLOR_HEX, getEquippedSkinColor } from "@/lib/skinColors";

interface Player {
  id: string;
  username: string;
  coin: number;
  diamond: number;
  ticket: number;
  currentStage: number;
  isAdmin?: boolean;
  tutorialCompleted: boolean;
  currentCharacter: string;
  skinColors: Record<string, string>;
}

interface VipProgress {
  level: number;
  expIntoCurrentLevel: number;
  expRequiredForNextLevel: number | null;
  isMaxLevel: boolean;
}

const MENU_ITEMS = [
  { href: "/play", label: "PLAY", icon: "⚔️", primary: true },
  { href: "/pvp", label: "PVP", icon: "🔫", primary: true, subtitle: "Costs 5 🎟️ per round" },
  { href: "/character", label: "CHARACTER / WEAPON", icon: "🪖" },
  { href: "/inventory", label: "INVENTORY", icon: "🎒" },
  { href: "/gacha", label: "GACHA", icon: "🏪" },
  { href: "/shop", label: "TRADE", icon: "💱" },
  { href: "/mission", label: "MISSION", icon: "🎯" },
  { href: "/leaderboard", label: "LEADERBOARD", icon: "🏆" },
  { href: "/mailbox", label: "MAILBOX", icon: "📬" },
  { href: "/income", label: "INCOME", icon: "💰" },
  { href: "/settings", label: "SETTINGS", icon: "⚙️" },
];

export default function HomeClient({ player, characterSprite, characterName, equippedWeaponId, vipProgress, greenBanknoteBalance, unreadMailCount, claimableMissionCount }: { player: Player; characterSprite: string; characterName: string; equippedWeaponId: string; vipProgress: VipProgress; greenBanknoteBalance: number; unreadMailCount: number; claimableMissionCount: number }) {

  // Warm the server-side sheet cache for the screens the player is most likely to
  // open next, so /play and /character render instantly off a warm cache instead
  // of triggering a fresh Google Sheets read on click.
  useEffect(() => {
    fetch("/api/stages").catch(() => {});
    fetch("/api/characters").catch(() => {});
    fetch("/api/weapons").catch(() => {});
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* v8 #8: battlefield background, darkened/blurred so it stays a backdrop, not the focus */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 blur-sm scale-110"
        style={{ backgroundImage: "url(/assets/sprites/background/battlefield_ground.svg)" }}
      />
      <div className="absolute inset-0 page-bg-themed opacity-90" />

      <div className="relative z-10 flex flex-col flex-1">
        {/* Top Bar */}
        <div className="bg-military-dark/80 backdrop-blur-sm border-b border-military-steel px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-military-tan text-sm font-bold truncate">{player.username}</p>
          </div>

          {/* v9 #2: VIP level + progress toward next level, earned only from story/farm stage-clear exp */}
          <div className="flex-1 max-w-xs hidden sm:block">
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-military-gold font-bold">VIP {vipProgress.level}</span>
              {!vipProgress.isMaxLevel && (
                <span className="text-military-steel">{vipProgress.expIntoCurrentLevel}/{vipProgress.expRequiredForNextLevel} exp</span>
              )}
            </div>
            <div className="h-1.5 bg-military-darker border border-military-steel">
              <div
                className="h-full bg-military-gold"
                style={{ width: vipProgress.isMaxLevel ? "100%" : `${Math.min(100, (vipProgress.expIntoCurrentLevel / (vipProgress.expRequiredForNextLevel ?? 1)) * 100)}%` }}
              />
            </div>
          </div>

          <CurrencyBar coin={player.coin} diamond={player.diamond} ticket={player.ticket} greenBanknote={greenBanknoteBalance} />
          {/* v17: plain link to a dedicated cookie-clearing route (not next-auth/react's
              signOut(), which was producing a raw Vercel 404) — a real navigation so the
              Set-Cookie deletion response header actually applies. */}
          <a href="/api/auth/logout" className="text-military-steel text-xs hover:text-white flex-shrink-0">LOGOUT</a>
        </div>

        {/* Main content: big equipped character + menu grid */}
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-6 max-w-5xl mx-auto w-full">
          <div className="flex flex-col items-center flex-shrink-0">
            <h1 className="text-2xl font-black text-military-tan tracking-widest mb-4 uppercase text-center">
              Military Shooter 2D
            </h1>
            {characterSprite ? (
              <div className="relative w-48 h-48">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={characterSprite}
                  alt={characterName}
                  className="w-48 h-48 object-contain"
                  style={{ filter: "drop-shadow(0 0 24px rgba(197,169,125,0.4))" }}
                />
                {/* v42: same equipped color skin shown everywhere else (Character page,
                 *  in-game, PvP) — this character's own entry in skinColors, never
                 *  shared with any other character. */}
                {(() => {
                  const hex = SKIN_COLOR_HEX[getEquippedSkinColor(player.skinColors, player.currentCharacter)];
                  return hex !== null ? (
                    <div
                      className="absolute inset-0 w-48 h-48 pointer-events-none"
                      style={{
                        backgroundColor: `#${hex.toString(16).padStart(6, "0")}`,
                        WebkitMaskImage: `url(${characterSprite})`,
                        WebkitMaskSize: "contain",
                        WebkitMaskRepeat: "no-repeat",
                        WebkitMaskPosition: "center",
                        maskImage: `url(${characterSprite})`,
                        maskSize: "contain",
                        maskRepeat: "no-repeat",
                        maskPosition: "center",
                        mixBlendMode: "multiply",
                      }}
                    />
                  ) : null;
                })()}
                {/* v10 #3 / v24 fix: weapon shown in-hand, matching in-game — anchored
                 *  at roughly the character's grip/hand height (66% down) with the
                 *  image's OWN grip point (72% down its own height, same 0.5/0.7
                 *  origin convention Player.ts uses in the real game) pinned there via
                 *  transform, instead of an untransformed top-left corner. The old
                 *  fixed top:18% put the top of every weapon sprite at head height,
                 *  which read as a stick poking out of the character's skull for any
                 *  long-barreled weapon (sniper, rasor gun, etc). */}
                {equippedWeaponId && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getWeaponSprite(equippedWeaponId)}
                    alt=""
                    className="absolute w-14 h-24 object-contain pointer-events-none"
                    style={{ left: "58%", top: "66%", transform: "translate(-50%, -75%)" }}
                  />
                )}
              </div>
            ) : (
              <div className="w-48 h-48 flex items-center justify-center text-6xl">🪖</div>
            )}
            <p className="text-military-steel text-sm mt-2">{characterName}</p>
            <p className="text-military-steel text-xs">Stage Progress: {player.currentStage}</p>
          </div>

          <div className="grid grid-cols-3 gap-3 w-full max-w-lg relative">
            {!player.tutorialCompleted && (
              <div className="absolute -top-10 left-0 right-0 flex flex-col items-center pointer-events-none z-20">
                <span className="text-military-gold text-xs font-bold uppercase tracking-widest bg-military-darker/90 px-3 py-1 border border-military-gold rounded mb-1">
                  Press PLAY to start
                </span>
                <span className="text-2xl animate-bounce text-military-gold">▼</span>
              </div>
            )}
            {(player.isAdmin ? [...MENU_ITEMS, { href: "/admin", label: "ADMIN", icon: "🛡️" }] : MENU_ITEMS).map((item) => {
              const locked = !player.tutorialCompleted && item.href !== "/play";
              const className = `relative card-military card-themed-glow flex flex-col items-center justify-center transition-all duration-200 ${
                item.primary
                  ? item.href === "/pvp"
                    ? "col-span-3 bg-military-danger border-red-400 hover:bg-red-700 text-xl py-6"
                    : "col-span-3 bg-military-green border-military-tan hover:bg-military-olive text-xl py-6"
                  : "p-4"
              } ${locked ? "opacity-30 pointer-events-none grayscale" : ""}`;

              const content = (
                <>
                  {item.href === "/mailbox" && unreadMailCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {unreadMailCount > 99 ? "99+" : unreadMailCount}
                    </span>
                  )}
                  {item.href === "/mission" && claimableMissionCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center leading-none">
                      {claimableMissionCount > 99 ? "99+" : claimableMissionCount}
                    </span>
                  )}
                  <span className="text-2xl mb-1">{item.icon}</span>
                  <span className="text-xs tracking-wider">{item.label}</span>
                  {"subtitle" in item && item.subtitle && (
                    <span className="text-military-tan/80 text-[11px] mt-1">{item.subtitle}</span>
                  )}
                </>
              );

              if (locked) {
                return <div key={item.href} className={className} aria-disabled>{content}</div>;
              }
              return (
                <Link key={item.href} href={item.href} onClick={() => sfx.play("ui_click")} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* v43: now a full dedicated guide page (src/app/how-to-play) instead of a
          cramped modal — tucked out of the way bottom-right so it never competes
          with the main menu grid. Hidden during the first-time tutorial, same as
          every other non-Play button. */}
      {player.tutorialCompleted && (
        <Link
          href="/how-to-play"
          onClick={() => sfx.play("ui_click")}
          className="fixed bottom-4 right-4 z-20 card-military card-themed-glow px-4 py-2 flex items-center gap-2 text-sm font-bold text-military-tan hover:text-white"
        >
          <span className="text-lg">❓</span> How to play?
        </Link>
      )}
    </div>
  );
}
