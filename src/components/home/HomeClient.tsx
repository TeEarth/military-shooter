"use client";

import { useEffect, useState } from "react";
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

interface HowToPlayTopic {
  id: string;
  label: string;
  icon: string;
  title: string;
  body: string[];
}

const HOW_TO_PLAY_TOPICS: HowToPlayTopic[] = [
  {
    id: "controls",
    label: "Move & Aim",
    icon: "/assets/sprites/characters/soldier_player.svg",
    title: "Move & Aim",
    body: [
      "Drag the left stick to move around the stage.",
      "Layout 1 (default touch): tap anywhere on the right half of the screen to aim AND fire at that exact spot.",
      "Layout 2: drag the right-side stick in a direction to aim and fire that way continuously.",
      "On desktop, use WASD/arrow keys to move and the mouse to aim — left-click or Space to fire, R or right-click to reload.",
    ],
  },
  {
    id: "cover",
    label: "Cover & Stealth",
    icon: "/assets/sprites/tilemap/cover_sandbag.svg",
    title: "Cover & Stealth",
    body: [
      "Sandbags, crates, houses, and walls are solid — they block both your bullets and the enemy's.",
      "Trees are different: bullets and footsteps both pass through them freely, but if you stand still near one for about a second, you become HIDDEN — enemies lose track of you until you move, shoot, or get shot again.",
    ],
  },
  {
    id: "story",
    label: "Clearing a Stage",
    icon: "/assets/sprites/tilemap/obstacle_house.svg",
    title: "Clearing a Story Stage",
    body: [
      "Each story stage has a fixed set of enemies placed on the map — eliminate all of them to clear the stage.",
      "Enemies freeze for a few seconds when the stage first loads, so you get a moment to find cover before combat starts.",
      "Clearing a stage grants coin + exp and unlocks the next one. A [NEXT STAGE] button appears on the results screen so you don't have to go back to Home between stages.",
      "A stage can only be cleared once — replaying an already-cleared story stage isn't possible (Retry only appears after a loss).",
    ],
  },
  {
    id: "farm",
    label: "Farm Stages",
    icon: "/assets/sprites/tilemap/cover_crate.svg",
    title: "Farm Stages",
    body: [
      "Farm stages are repeatable, endless-wave survival — enemies keep spawning in escalating waves instead of a fixed list.",
      "Each wave briefly freezes after spawning so you can reposition before it turns hostile.",
      "Tougher enemy types unlock as your wave number climbs; your best wave reached also unlocks certain weapons (like the Rasor Gun) for purchase.",
      "Rewards are based on the highest wave you reach and the coins earned from kills that run — there's no fixed \"clear\" reward like a story stage.",
    ],
  },
  {
    id: "boss",
    label: "Boss Fights",
    icon: "/assets/sprites/weapons/gatling.svg",
    title: "Boss Fights",
    body: [
      "Every Multiverse ends in a boss stage — a huge top-of-screen HP bar shows the boss's health.",
      "Boss arenas have zero cover, so positioning and ammo management matter more than hiding.",
      "The boss periodically summons a minion right at its own position to reinforce itself — watch your flanks once you hear/see one appear.",
      "Defeating a boss unlocks the next Multiverse's story stages.",
    ],
  },
  {
    id: "shop",
    label: "Buying Weapons & Characters",
    icon: "/assets/sprites/weapons/ak47.svg",
    title: "Buying Weapons & Characters",
    body: [
      "New weapons and characters are unlocked from the Character page — each one lists its unlock requirement: a ticket cost, a specific story stage cleared, or a farm-stage wave reached (in ANY Multiverse's farm stage).",
      "Once unlocked, equip a weapon or character from the same page — your loadout carries into every stage, farm run, and PvP match.",
    ],
  },
  {
    id: "exchange",
    label: "Exchanging Resources",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Exchanging Resources",
    body: [
      "The Trade page lets you convert between currencies (e.g. coin ↔ diamond) at rates set by the game's economy config.",
      "This is separate from real-money top-up and cash withdrawal — Trade only moves in-game currencies against each other.",
    ],
  },
  {
    id: "withdraw",
    label: "Cashing Out (Real Money)",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Cashing Out (Real Money)",
    body: [
      "Green Banknotes are earned from boss kills and every few personal stage milestones — they're the only currency that converts to real money.",
      "From the Income page, request a withdrawal to your TrueMoney Wallet phone number (1 banknote = ฿1, capped at 100 baht/day).",
      "Withdrawals are reviewed and paid out manually by an admin, not instantly — check your Mailbox for the approval notice.",
    ],
  },
  {
    id: "topup",
    label: "Topping Up",
    icon: "/assets/sprites/ui/gacha_capsule_ticket.svg",
    title: "Topping Up",
    body: [
      "The Income page's Top Up section sells ticket packages for real money via Omise — pay by card or PromptPay QR.",
      "PromptPay payments confirm automatically once you scan and pay — no need to refresh, the page polls for you.",
      "Your top-up history (date, amount, method, status) is listed right under the packages on the Income page.",
    ],
  },
  {
    id: "passive",
    label: "Passive Upgrades",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Passive Upgrades",
    body: [
      "Passive upgrades are permanent stat boosts (hp, damage, speed, etc.) bought with coin from the Character page, stacking on top of whatever weapon/character you have equipped.",
      "Each upgrade tier costs more than the last — invest coin from farming or story clears here to make every future stage easier.",
    ],
  },
  {
    id: "gacha",
    label: "Gacha",
    icon: "/assets/sprites/ui/gacha_burst.svg",
    title: "Gacha",
    body: [
      "The Gacha page spends diamonds or tickets on a randomized pull for characters, weapons, or cosmetics.",
      "Use the Skip button during the reveal animation if you'd rather see the result immediately instead of watching the full reveal.",
      "Multi-pull discounts (if configured) are shown right on the pull button.",
    ],
  },
  {
    id: "equipment",
    label: "Equipping Gear",
    icon: "/assets/sprites/tilemap/cover_sandbag.svg",
    title: "Equipping Gear",
    body: [
      "The Inventory page holds every weapon, character, and equipment piece you've unlocked or pulled from gacha.",
      "Tap an item to equip it — equipped gear applies immediately to your next stage, farm run, or PvP match.",
    ],
  },
  {
    id: "mission",
    label: "Missions",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Missions",
    body: [
      "The Mission page lists daily/ongoing objectives (like clearing a stage or getting kills) that pay out coin, exp, or tickets when completed.",
      "Missions reset periodically — check back regularly for free rewards you'd otherwise leave on the table.",
    ],
  },
  {
    id: "leaderboard",
    label: "Leaderboard",
    icon: "/assets/sprites/ui/star_upgrade.svg",
    title: "Leaderboard",
    body: [
      "The Leaderboard ranks players by their highest farm-stage wave reached, resetting weekly.",
      "Top-ranked players earn bonus rewards when the week resets — check the Leaderboard page for the current cutoffs.",
    ],
  },
  {
    id: "pvp",
    label: "PvP",
    icon: "/assets/sprites/weapons/double_pistol.svg",
    title: "PvP",
    body: [
      "PvP is a real-time 1v1 arena — tap FIND MATCH and you'll be paired with the next player also searching (usually within a few seconds).",
      "Your equipped character/weapon/passive upgrades carry into the match — daily ammo limits don't apply in PvP, only magazine size.",
      "Winning grants a small coin + ticket reward. There's no pause in PvP (it would desync the match), so make sure you're ready before queuing.",
    ],
  },
  {
    id: "currency",
    label: "Currencies",
    icon: "/assets/sprites/ui/coin_pop.svg",
    title: "Currencies",
    body: [
      "Coin — earned from stage/farm clears, spent on weapons, upgrades, and Trade exchanges.",
      "Diamond — premium currency, mainly spent on Gacha pulls.",
      "Ticket — spent on story-attempt costs, revives, and some weapon unlocks; purchasable via top-up.",
      "Green Banknote — earned from boss kills and stage milestones, the only currency that withdraws to real money.",
    ],
  },
];

export default function HomeClient({ player, characterSprite, characterName, equippedWeaponId, vipProgress, greenBanknoteBalance, unreadMailCount }: { player: Player; characterSprite: string; characterName: string; equippedWeaponId: string; vipProgress: VipProgress; greenBanknoteBalance: number; unreadMailCount: number }) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [howToPlayTopicId, setHowToPlayTopicId] = useState(HOW_TO_PLAY_TOPICS[0].id);

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

      {/* v24: "How to play?" — a quick reference for new players, tucked out of the
          way bottom-right so it never competes with the main menu grid. Hidden
          during the first-time tutorial, same as every other non-Play button. */}
      {player.tutorialCompleted && (
        <button
          onClick={() => { sfx.play("ui_click"); setHowToPlayOpen(true); }}
          className="fixed bottom-4 right-4 z-20 card-military card-themed-glow px-4 py-2 flex items-center gap-2 text-sm font-bold text-military-tan hover:text-white"
        >
          <span className="text-lg">❓</span> How to play?
        </button>
      )}

      {howToPlayOpen && (() => {
        const activeTopic = HOW_TO_PLAY_TOPICS.find((t) => t.id === howToPlayTopicId) ?? HOW_TO_PLAY_TOPICS[0];
        return (
          <div
            className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setHowToPlayOpen(false)}
          >
            <div
              className="card-military w-full max-w-3xl h-[85vh] flex flex-col p-0 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-military-steel flex-shrink-0">
                <h2 className="text-lg font-black text-military-tan uppercase tracking-widest">How to Play</h2>
                <button
                  onClick={() => { sfx.play("ui_click"); setHowToPlayOpen(false); }}
                  className="text-military-steel hover:text-white text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-1 min-h-0">
                {/* Topic list — click any topic to jump straight to its explanation. */}
                <div className="w-40 sm:w-52 flex-shrink-0 border-r border-military-steel overflow-y-auto">
                  {HOW_TO_PLAY_TOPICS.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => { sfx.play("ui_click"); setHowToPlayTopicId(topic.id); }}
                      className={`w-full text-left px-3 py-2.5 text-xs border-b border-military-steel/40 flex items-center gap-2 ${
                        topic.id === activeTopic.id ? "bg-military-dark text-military-gold font-bold" : "text-military-steel hover:text-white"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={topic.icon} alt="" className="w-5 h-5 object-contain flex-shrink-0" />
                      <span className="leading-tight">{topic.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="flex items-center gap-3 mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={activeTopic.icon} alt="" className="w-10 h-10 object-contain flex-shrink-0" />
                    <h3 className="text-base font-bold text-military-gold uppercase tracking-wider">{activeTopic.title}</h3>
                  </div>
                  <ul className="space-y-2.5 list-disc list-inside">
                    {activeTopic.body.map((line, i) => (
                      <li key={i} className="text-sm text-military-steel leading-relaxed">{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
