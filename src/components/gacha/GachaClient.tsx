"use client";

import { useState } from "react";
import Link from "next/link";
import type { GachaConfigRow, GachaPullResult } from "@/lib/google/gacha";
import type { Rarity } from "@/lib/google/inventory";
import { sfx } from "@/lib/sfx";
import { getEquipmentSprite } from "@/lib/spriteHelpers";
import CurrencyBar from "@/components/ui/CurrencyBar";

interface PoolGroup {
  poolId: string;
  entries: GachaConfigRow[];
}

const RARITY_COLOR: Record<string, string> = {
  common: "text-gray-300",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-military-gold",
};

const RARITY_BORDER: Record<Rarity, string> = {
  common: "border-gray-400",
  rare: "border-blue-400",
  epic: "border-purple-400",
  legendary: "border-military-gold",
};

type AnimPhase = "idle" | "capsule" | "pop" | "reveal";

/** v10 #1: x10 pull costs 10x the single price minus a flat 5% discount. */
const MULTI_PULL_COUNT = 10;
const MULTI_PULL_DISCOUNT = 0.05;

/** v8 #4: ticket pool gets its own gold capsule sprite, diamond pool keeps the original. */
function capsuleSpriteForCurrency(currency: string): string {
  return currency === "ticket" ? "/assets/sprites/ui/gacha_capsule_ticket.svg" : "/assets/sprites/ui/shop_gacha_capsule.svg";
}

// v20: full-screen "falling from the sky" reveal timing — one capsule per pull
// (1 or 10), staggered so they don't all land in the same instant.
const FALL_MS = 900;
const FALL_STAGGER_MS = 70;
function popDelayFor(count: number) {
  return (count - 1) * FALL_STAGGER_MS + FALL_MS + 150;
}
function revealDelayFor(count: number) {
  return popDelayFor(count) + 300;
}

/** Scatters capsules across the full-screen overlay instead of stacking them
 *  in one spot — a single pull drops dead center, a x10 pull spreads into a
 *  5-wide, 2-row meteor shower with alternating tumble direction. */
function capsulePositions(count: number): { left: number; top: number; rotFrom: number; rotTo: number }[] {
  if (count <= 1) return [{ left: 50, top: 42, rotFrom: -20, rotTo: 10 }];
  const cols = 5;
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      left: 10 + col * 20,
      top: row === 0 ? 32 : 58,
      rotFrom: i % 2 === 0 ? -25 : 25,
      rotTo: i % 2 === 0 ? 12 : -12,
    };
  });
}

/** v14: decorative equipment/currency icons scattered around the page edges,
 *  purely visual (pointer-events disabled), fixed positions so they don't
 *  shift on re-render. */
const DECOR_EQUIPMENT: { id: string; top: string; left: string; size: number; rotate: number; opacity: number }[] = [
  { id: "helmet_legendary", top: "6%", left: "3%", size: 90, rotate: -12, opacity: 0.16 },
  { id: "vest_epic", top: "68%", left: "5%", size: 100, rotate: 10, opacity: 0.14 },
  { id: "boots_rare", top: "82%", left: "14%", size: 70, rotate: -6, opacity: 0.14 },
  { id: "helmet_epic", top: "12%", left: "90%", size: 85, rotate: 14, opacity: 0.15 },
  { id: "vest_legendary", top: "60%", left: "92%", size: 100, rotate: -10, opacity: 0.16 },
  { id: "boots_common", top: "85%", left: "82%", size: 65, rotate: 8, opacity: 0.13 },
  { id: "helmet_rare", top: "40%", left: "1%", size: 60, rotate: 20, opacity: 0.12 },
  { id: "vest_common", top: "30%", left: "95%", size: 60, rotate: -18, opacity: 0.12 },
];
const DECOR_CURRENCY: { icon: string; top: string; left: string; size: string; opacity: number }[] = [
  { icon: "💎", top: "20%", left: "8%", size: "text-4xl", opacity: 0.2 },
  { icon: "🪙", top: "48%", left: "3%", size: "text-3xl", opacity: 0.18 },
  { icon: "🎟️", top: "75%", left: "8%", size: "text-3xl", opacity: 0.18 },
  { icon: "💎", top: "35%", left: "88%", size: "text-3xl", opacity: 0.18 },
  { icon: "🪙", top: "78%", left: "92%", size: "text-4xl", opacity: 0.2 },
  { icon: "🎟️", top: "15%", left: "80%", size: "text-3xl", opacity: 0.16 },
];

export default function GachaClient({ pools, coin, diamond: initialDiamond, ticket: initialTicket, exp, greenBanknote }: { pools: PoolGroup[]; coin: number; diamond: number; ticket: number; exp: number; greenBanknote: number }) {
  const [diamond, setDiamond] = useState(initialDiamond);
  const [ticket, setTicket] = useState(initialTicket);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [lastResult, setLastResult] = useState<GachaPullResult | null>(null);
  const [multiResults, setMultiResults] = useState<GachaPullResult[] | null>(null);
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const [activeCurrency, setActiveCurrency] = useState<string>("diamond");
  // v14: tracked separately from multiResults (which is null until the reveal
  // beat) so the capsule/pop phases know to render 10 capsules, not 1.
  const [pullMode, setPullMode] = useState<"single" | "multi">("single");

  async function pull(poolId: string, currency: string) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    setLastResult(null);
    setMultiResults(null);
    setPullMode("single");
    setActiveCurrency(currency);
    setPhase("capsule");
    try {
      const res = await fetch("/api/gacha/pull", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId }),
      });
      const data = await res.json();
      if (data.success) {
        // Sequence: capsule falls from off-screen -> pops (sfx here) -> burst + item reveal.
        setTimeout(() => {
          setPhase("pop");
          sfx.play("gacha_reveal");
        }, popDelayFor(1));
        setTimeout(() => {
          setPhase("reveal");
          setLastResult(data.result);
          if (data.updatedPlayer) {
            setDiamond(data.updatedPlayer.diamond);
            setTicket(data.updatedPlayer.ticket);
          }
        }, revealDelayFor(1));
      } else {
        setMessage(data.error);
        setPhase("idle");
      }
    } finally {
      setLoading(false);
    }
  }

  /** v14: x10 now shows all 10 capsules spinning/popping together (not one
   *  shared capsule sprite), so the "อลังการ" spectacle scales with the pull
   *  count instead of looking like a single pull with a bigger result grid. */
  async function pullMulti(poolId: string, currency: string) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    setLastResult(null);
    setMultiResults(null);
    setPullMode("multi");
    setActiveCurrency(currency);
    setPhase("capsule");
    try {
      const res = await fetch("/api/gacha/pull-multi", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId }),
      });
      const data = await res.json();
      if (data.success) {
        setTimeout(() => {
          setPhase("pop");
          sfx.play("gacha_reveal");
        }, popDelayFor(MULTI_PULL_COUNT));
        setTimeout(() => {
          setPhase("reveal");
          setMultiResults(data.results);
          if (data.updatedPlayer) {
            setDiamond(data.updatedPlayer.diamond);
            setTicket(data.updatedPlayer.ticket);
          }
        }, revealDelayFor(MULTI_PULL_COUNT));
      } else {
        setMessage(data.error);
        setPhase("idle");
      }
    } finally {
      setLoading(false);
    }
  }

  function closeReveal() {
    setPhase("idle");
    setLastResult(null);
    setMultiResults(null);
  }

  function renderResultContent(result: GachaPullResult) {
    if (result.rewardType === "currency") {
      return (
        <div className="gacha-anim-item">
          <span className="text-5xl block mb-2">{result.rewardCurrency === "coin" ? "🪙" : "💎"}</span>
          <p className="text-military-gold font-bold">+{result.rewardAmount} {result.rewardCurrency === "coin" ? "coin" : "diamond"}</p>
        </div>
      );
    }

    const rarity = (result.rarity ?? "common") as Rarity;
    const isLegendary = rarity === "legendary";

    return (
      <div className="gacha-anim-item flex flex-col items-center">
        <div className={`relative w-24 h-24 mb-2 rounded-full border-2 ${RARITY_BORDER[rarity]} ${isLegendary ? "gacha-anim-glow-legendary" : ""} ${RARITY_COLOR[rarity]} flex items-center justify-center bg-military-darker`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getEquipmentSprite(result.equipmentId ?? "")} alt={result.equipmentName ?? ""} className="w-16 h-16 object-contain" />
        </div>
        <p className={`font-bold uppercase ${RARITY_COLOR[rarity]}`}>{rarity} {result.slot}</p>
        <p className="text-white">{result.equipmentName}</p>
        {result.isDupe ? (
          <p className="text-green-400 text-sm">Duplicate — upgraded to level {result.newUpgradeLevel}!</p>
        ) : (
          <p className="text-military-gold text-sm">New item added to inventory!</p>
        )}
      </div>
    );
  }

  function renderCompactResult(result: GachaPullResult, key: number) {
    // Staggered reveal (40ms/item) so all 10 land almost together but still
    // feel like a cascade rather than a flat, static grid.
    const style = { animationDelay: `${key * 40}ms` } as React.CSSProperties;

    if (result.rewardType === "currency") {
      return (
        <div key={key} style={style} className="gacha-anim-item flex flex-col items-center bg-military-darker/60 border border-military-steel rounded p-2">
          <span className="text-2xl">{result.rewardCurrency === "coin" ? "🪙" : "💎"}</span>
          <p className="text-military-gold text-xs font-bold">+{result.rewardAmount}</p>
        </div>
      );
    }
    const rarity = (result.rarity ?? "common") as Rarity;
    return (
      <div key={key} style={style} className={`gacha-anim-item flex flex-col items-center bg-military-darker/60 border rounded p-2 ${RARITY_BORDER[rarity]}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getEquipmentSprite(result.equipmentId ?? "")} alt={result.equipmentName ?? ""} className="w-10 h-10 object-contain" />
        <p className={`text-[10px] font-bold uppercase ${RARITY_COLOR[rarity]}`}>{rarity}</p>
        {result.isDupe && <p className="text-green-400 text-[10px]">+lvl {result.newUpgradeLevel}</p>}
      </div>
    );
  }

  const isLegendaryReveal = lastResult?.rewardType === "equipment" && lastResult.rarity === "legendary";
  const hasLegendaryInMulti = (multiResults ?? []).some((r) => r.rewardType === "equipment" && r.rarity === "legendary");
  const capsuleCount = pullMode === "multi" ? MULTI_PULL_COUNT : 1;

  return (
    <div className="min-h-screen page-bg-themed p-6 relative overflow-hidden">
      {/* v14: full-screen decorative backdrop — equipment + currency icons
       *  scattered around the edges, purely visual. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {DECOR_EQUIPMENT.map((d, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={getEquipmentSprite(d.id)}
            alt=""
            style={{ position: "absolute", top: d.top, left: d.left, width: d.size, height: d.size, opacity: d.opacity, transform: `rotate(${d.rotate}deg)` }}
          />
        ))}
        {DECOR_CURRENCY.map((d, i) => (
          <span key={i} className={d.size} style={{ position: "absolute", top: d.top, left: d.left, opacity: d.opacity }}>{d.icon}</span>
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/sprites/ui/shop_gacha_capsule.svg" alt="" className="w-8 h-8" />
            <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Gacha</h1>
          </div>
          <div className="ml-auto">
            <CurrencyBar coin={coin} diamond={diamond} ticket={ticket} greenBanknote={greenBanknote} />
          </div>
        </div>

        {message && <div className="max-w-4xl mx-auto mb-4 text-red-400 text-sm">{message}</div>}

        {phase !== "idle" && (
          <div
            className="gacha-anim-overlay fixed inset-0 z-[100] bg-black/88 flex items-center justify-center overflow-hidden"
            onClick={() => phase === "reveal" && closeReveal()}
          >
            {/* Faint sky-glow behind the falling capsules, purely atmospheric. */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(197,169,125,0.18), transparent 60%)" }}
            />

            {phase === "capsule" && (
              <div className="absolute inset-0">
                {capsulePositions(capsuleCount).map((pos, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={capsuleSpriteForCurrency(activeCurrency)}
                    alt=""
                    className={`${capsuleCount > 1 ? "w-16 h-16" : "w-28 h-28"} gacha-anim-fall absolute -translate-x-1/2 -translate-y-1/2`}
                    style={{
                      left: `${pos.left}%`,
                      top: `${pos.top}%`,
                      animationDelay: `${i * FALL_STAGGER_MS}ms`,
                      "--rot-from": `${pos.rotFrom}deg`,
                      "--rot-to": `${pos.rotTo}deg`,
                    } as React.CSSProperties}
                  />
                ))}
              </div>
            )}

            {phase === "pop" && (
              <div className="absolute inset-0">
                {capsulePositions(capsuleCount).map((pos, i) => (
                  <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capsuleSpriteForCurrency(activeCurrency)}
                      alt=""
                      className={`${capsuleCount > 1 ? "w-16 h-16" : "w-28 h-28"} gacha-anim-pop`}
                    />
                    {Array.from({ length: capsuleCount > 1 ? 5 : 8 }).map((_, p) => {
                      const angle = (p / (capsuleCount > 1 ? 5 : 8)) * Math.PI * 2;
                      const reach = capsuleCount > 1 ? 45 : 100;
                      return (
                        <span
                          key={p}
                          className="gacha-anim-particle absolute left-1/2 top-1/2 w-2 h-2 rounded-full bg-military-gold"
                          style={{ "--px": `${Math.cos(angle) * reach}px`, "--py": `${Math.sin(angle) * reach}px` } as React.CSSProperties}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {phase === "reveal" && (
              <>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/sprites/ui/gacha_burst.svg"
                    alt=""
                    className={`w-[32rem] h-[32rem] ${isLegendaryReveal || hasLegendaryInMulti ? "gacha-anim-burst-legendary" : "gacha-anim-burst"}`}
                  />
                </div>
                <div className="relative max-w-2xl w-full px-6 text-center">
                  {(isLegendaryReveal || hasLegendaryInMulti) && (
                    <p className="gacha-anim-title text-military-gold text-2xl font-black tracking-widest mb-4 gacha-anim-glow-legendary">✨ LEGENDARY! ✨</p>
                  )}
                  {multiResults ? (
                    <div className="grid grid-cols-5 gap-3 mx-auto">
                      {multiResults.map((r, i) => renderCompactResult(r, i))}
                    </div>
                  ) : (
                    lastResult && renderResultContent(lastResult)
                  )}
                  <button onClick={closeReveal} className="btn-military text-xs mt-8">TAP TO CONTINUE</button>
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {pools.map((pool) => {
            const cost = pool.entries[0]?.cost ?? 0;
            const currency = pool.entries[0]?.currency ?? "diamond";
            const balance = currency === "diamond" ? diamond : ticket;
            const multiCost = Math.round(cost * MULTI_PULL_COUNT * (1 - MULTI_PULL_DISCOUNT));

            return (
              <div key={pool.poolId} className="card-military text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={capsuleSpriteForCurrency(currency)} alt="" className="w-16 h-16 mx-auto mb-3" />
                <h2 className="font-bold text-lg mb-3 capitalize">{pool.poolId.replace(/_/g, " ")}</h2>

                <div className="text-xs text-military-steel space-y-1 mb-4 text-left">
                  {pool.entries.map((e, i) => (
                    <div key={i} className="flex justify-between">
                      <span className={e.rewardType === "equipment" ? RARITY_COLOR[e.rarity] : ""}>
                        {e.rewardType === "equipment" ? e.rarity.toUpperCase() : `${e.rewardCurrency} +${e.rewardAmount}`}
                      </span>
                      <span>{Math.round(e.dropRate * 100)}%</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => pull(pool.poolId, currency)}
                    disabled={loading || balance < cost}
                    className="btn-gold flex-1 py-2"
                  >
                    {loading ? "..." : `Pull — ${currency === "diamond" ? "💎" : "🎟️"} ${cost}`}
                  </button>
                  <button
                    onClick={() => pullMulti(pool.poolId, currency)}
                    disabled={loading || balance < multiCost}
                    className="btn-gold flex-1 py-2"
                    title="10 independent pulls, 5% cheaper than 10x the single price"
                  >
                    {loading ? "..." : `x10 — ${currency === "diamond" ? "💎" : "🎟️"} ${multiCost}`}
                  </button>
                </div>
              </div>
            );
          })}
          {pools.length === 0 && <p className="text-military-steel text-sm col-span-2 text-center py-12">No gacha pools configured yet.</p>}
        </div>
      </div>
    </div>
  );
}
