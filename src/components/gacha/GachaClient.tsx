"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { GachaConfigRow, GachaPullResult } from "@/lib/google/gacha";
import type { Rarity } from "@/lib/google/inventory";
import { sfx } from "@/lib/sfx";
import { getEquipmentSprite } from "@/lib/spriteHelpers";
import CurrencyBar from "@/components/ui/CurrencyBar";
import Icon from "@/components/ui/Icon";
import { showInsufficientFundsToast } from "@/components/ui/Toast";

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

/** v33 cinematic reveal pass: idle -> charging (energy sphere, color escalates
 *  with the pull's best rarity) -> explode (flash + shockwave + burst) ->
 *  reveal (cards launch from center to a grid, face-down; click one or "Reveal
 *  All" to flip). Replaces the old "capsule"/"pop" falling-capsule phases —
 *  same backend calls (/api/gacha/pull, /api/gacha/pull-multi), same reward
 *  math, only the presentation changed. */
type AnimPhase = "idle" | "charging" | "explode" | "reveal";
type ChargeRarity = "common" | "rare" | "epic" | "legendary";

const RARITY_ORDER: ChargeRarity[] = ["common", "rare", "epic", "legendary"];
/** Charging sphere / shockwave / beam color per escalation tier. */
const CHARGE_COLOR: Record<ChargeRarity, string> = {
  common: "#5aa7e0",
  rare: "#8b5cf6",
  epic: "#d4af37",
  legendary: "#ffffff",
};

/** v10 #1: x10 pull costs 10x the single price minus a flat 5% discount. */
const MULTI_PULL_COUNT = 10;
const MULTI_PULL_DISCOUNT = 0.05;

/** v8 #4: ticket pool gets its own gold capsule sprite, diamond pool keeps the original. */
function capsuleSpriteForCurrency(currency: string): string {
  return currency === "ticket" ? "/assets/sprites/ui/gacha_capsule_ticket.svg" : "/assets/sprites/ui/shop_gacha_capsule.svg";
}

/** Same icon-manager glyphs used everywhere else (CurrencyBar, Character hub)
 *  instead of the old raw emoji — this page's currency spend/reward displays
 *  were the one place still out of step with the rest of the app. */
function CurrencyCost({ currency, amount }: { currency: string; amount: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon name={currency === "coin" ? "coin" : currency === "ticket" ? "ticket" : "diamond"} size={16} />
      {amount.toLocaleString()}
    </span>
  );
}

const CHARGE_MS = 900;
const EXPLODE_MS = 550;
const CARD_LAUNCH_STAGGER_MS = 85;
const CARD_FLIP_STAGGER_MS = 90;

function bestRarity(results: GachaPullResult[]): ChargeRarity {
  let best: ChargeRarity = "common";
  for (const r of results) {
    if (r.rewardType !== "equipment" || !r.rarity) continue;
    const idx = RARITY_ORDER.indexOf(r.rarity as ChargeRarity);
    if (idx > RARITY_ORDER.indexOf(best)) best = r.rarity as ChargeRarity;
  }
  return best;
}

/** Grid layout for the reveal phase — a single pull centers one big card, a
 *  x10 pull spreads into a 5-wide, 2-row grid. Also used to compute each
 *  card's "launch from center" vector for the fly-out animation. */
function cardPositions(count: number): { left: number; top: number; rotFrom: number }[] {
  if (count <= 1) return [{ left: 50, top: 46, rotFrom: 0 }];
  const cols = 5;
  return Array.from({ length: count }, (_, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      left: 10 + col * 20,
      top: row === 0 ? 32 : 60,
      rotFrom: i % 2 === 0 ? -18 : 18,
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
  const [results, setResults] = useState<GachaPullResult[]>([]);
  const [phase, setPhase] = useState<AnimPhase>("idle");
  const [activeCurrency, setActiveCurrency] = useState<string>("diamond");
  const [chargeRarity, setChargeRarity] = useState<ChargeRarity>("common");
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [legendarySpotlight, setLegendarySpotlight] = useState<number | null>(null);

  // v24: SKIP button — the pull's real result is already known the moment the
  // fetch resolves, well before the charge/explode animation finishes
  // playing; skip just cancels the pending timers and jumps straight to the
  // face-down reveal grid instead of waiting them out.
  const pendingTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingReveal = useRef<(() => void) | null>(null);
  // v25 fix: the Skip button appears the instant phase becomes "charging" —
  // synchronously, before the fetch has even been sent — but pendingReveal
  // is only populated once that fetch resolves. Clicking Skip immediately
  // landed in that gap and silently did nothing. This flag records "skip was
  // requested" so the fetch-resolved handler honors it the moment the real
  // result is known, instead of the click being lost.
  const skipRequested = useRef(false);

  function clearPendingTimers() {
    pendingTimers.current.forEach(clearTimeout);
    pendingTimers.current = [];
  }

  function skipToReveal() {
    if (!pendingReveal.current) {
      skipRequested.current = true;
      return;
    }
    clearPendingTimers();
    pendingReveal.current();
    pendingReveal.current = null;
    skipRequested.current = false;
  }

  async function runPull(url: string, poolId: string, currency: string, count: number) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    setMessage("");
    setResults([]);
    setRevealed(new Set());
    setLegendarySpotlight(null);
    setActiveCurrency(currency);
    setChargeRarity("common");
    setPhase("charging");
    sfx.play("gacha_charge");
    skipRequested.current = false;
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poolId }),
      });
      const data = await res.json();
      if (data.success) {
        const pulled: GachaPullResult[] = data.results ?? [data.result];
        const rarity = bestRarity(pulled);
        const applyReveal = () => {
          setPhase("explode");
          setChargeRarity(rarity);
          if (data.updatedPlayer) {
            setDiamond(data.updatedPlayer.diamond);
            setTicket(data.updatedPlayer.ticket);
          }
          pendingTimers.current.push(setTimeout(() => {
            setResults(pulled);
            setPhase("reveal");
          }, EXPLODE_MS));
        };
        pendingReveal.current = applyReveal;
        if (skipRequested.current) {
          skipRequested.current = false;
          pendingReveal.current = null;
          setChargeRarity(rarity);
          setPhase("reveal");
          setResults(pulled);
          if (data.updatedPlayer) {
            setDiamond(data.updatedPlayer.diamond);
            setTicket(data.updatedPlayer.ticket);
          }
        } else {
          // Escalate the charging color/sound the moment the real rarity is
          // known (mid-charge, before the visible explosion) — this is the
          // "anticipation" beat: a rare+ pull visibly and audibly intensifies
          // before anything is revealed.
          if (rarity !== "common") {
            setChargeRarity(rarity);
            sfx.play("gacha_charge_rare");
          }
          const elapsed = 0; // fetch already took real time; just hold the remaining charge beat
          pendingTimers.current.push(setTimeout(applyReveal, Math.max(150, CHARGE_MS - elapsed)));
        }
      } else {
        setMessage(data.error);
        setPhase("idle");
      }
    } finally {
      setLoading(false);
    }
  }

  function pull(poolId: string, currency: string, cost: number, balance: number) {
    if (balance < cost) { showInsufficientFundsToast(currency === "ticket" ? "ticket" : "diamond", cost, balance); return; }
    void runPull("/api/gacha/pull", poolId, currency, 1);
  }
  function pullMulti(poolId: string, currency: string, cost: number, balance: number) {
    if (balance < cost) { showInsufficientFundsToast(currency === "ticket" ? "ticket" : "diamond", cost, balance); return; }
    void runPull("/api/gacha/pull-multi", poolId, currency, MULTI_PULL_COUNT);
  }

  function flipCard(i: number) {
    if (revealed.has(i)) return;
    const r = results[i];
    const isLegendary = r?.rewardType === "equipment" && r.rarity === "legendary";
    if (isLegendary) {
      setLegendarySpotlight(i);
      sfx.play("gacha_legendary");
      pendingTimers.current.push(setTimeout(() => {
        setLegendarySpotlight(null);
        setRevealed((prev) => new Set(prev).add(i));
      }, 2200));
    } else {
      sfx.play("gacha_flip");
      setRevealed((prev) => new Set(prev).add(i));
    }
  }

  function revealAll() {
    results.forEach((r, i) => {
      if (revealed.has(i)) return;
      pendingTimers.current.push(setTimeout(() => flipCard(i), i * CARD_FLIP_STAGGER_MS));
    });
  }

  function closeReveal() {
    clearPendingTimers();
    setPhase("idle");
    setResults([]);
    setRevealed(new Set());
    setLegendarySpotlight(null);
  }

  function cardBack(sizeClass: string) {
    return (
      <div className={`gacha-flip-face gacha-flip-face-back ${sizeClass} rounded-lg border-2 border-military-tan bg-military-darker flex items-center justify-center overflow-hidden`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={capsuleSpriteForCurrency(activeCurrency)} alt="" className="w-2/3 h-2/3 object-contain opacity-80" />
      </div>
    );
  }

  function cardFront(result: GachaPullResult, big: boolean) {
    if (result.rewardType === "currency") {
      return (
        <div className={`gacha-flip-face gacha-flip-face-front ${big ? "w-64 h-64" : "w-full h-full"} rounded-lg border-2 border-military-steel bg-military-darker flex flex-col items-center justify-center gap-1`}>
          <Icon name={result.rewardCurrency === "coin" ? "coin" : "diamond"} size={big ? 72 : 32} />
          <p className={`text-military-gold font-bold ${big ? "text-2xl" : "text-sm"}`}>+{result.rewardAmount}</p>
        </div>
      );
    }
    const rarity = (result.rarity ?? "common") as Rarity;
    const isLegendary = rarity === "legendary";
    return (
      <div className={`gacha-flip-face gacha-flip-face-front ${big ? "w-64 h-64" : "w-full h-full"} rounded-lg border-2 ${RARITY_BORDER[rarity]} ${isLegendary ? "gacha-anim-glow-legendary" : ""} bg-military-darker flex flex-col items-center justify-center p-2 gap-1`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getEquipmentSprite(result.equipmentId ?? "")} alt={result.equipmentName ?? ""} className={big ? "w-36 h-36 object-contain" : "w-20 h-20 object-contain"} />
        <p className={`font-bold uppercase ${big ? "text-lg" : "text-xs"} ${RARITY_COLOR[rarity]}`}>{rarity}</p>
        {result.isDupe && <p className="text-green-400 text-xs">+lvl {result.newUpgradeLevel}</p>}
      </div>
    );
  }

  const totalCount = results.length;
  const allRevealed = totalCount > 0 && revealed.size === totalCount;
  const summary = allRevealed
    ? results.reduce(
        (acc, r) => {
          if (r.rewardType === "currency") {
            acc.currency += r.rewardAmount ?? 0;
          } else {
            const r2 = (r.rarity ?? "common") as Rarity;
            acc.byRarity[r2] = (acc.byRarity[r2] ?? 0) + 1;
            if (r.isDupe) acc.dupes += 1;
          }
          return acc;
        },
        { currency: 0, dupes: 0, byRarity: {} as Partial<Record<Rarity, number>> }
      )
    : null;

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
            className="gacha-anim-overlay gacha-anim-bg-darken fixed inset-0 z-[100] bg-black/92 flex items-center justify-center overflow-hidden"
            onClick={() => phase === "reveal" && allRevealed && closeReveal()}
          >
            {/* Faint sky-glow behind everything, purely atmospheric. */}
            <div
              className="absolute inset-0 pointer-events-none transition-colors duration-500"
              style={{ background: `radial-gradient(ellipse at 50% 46%, ${CHARGE_COLOR[chargeRarity]}22, transparent 60%)` }}
            />

            {(phase === "charging" || phase === "explode") && (
              <button
                onClick={(e) => { e.stopPropagation(); skipToReveal(); }}
                className="absolute top-6 right-6 z-10 text-military-steel hover:text-white text-xs border border-military-steel hover:border-military-tan px-3 py-1.5 rounded uppercase tracking-wider"
              >
                Skip ▸▸
              </button>
            )}

            {phase === "charging" && (
              <div className="relative flex items-center justify-center" style={{ width: 260, height: 260 }}>
                <div
                  className="gacha-anim-charge-rays absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, ${CHARGE_COLOR[chargeRarity]}55 20deg, transparent 40deg, transparent 180deg, ${CHARGE_COLOR[chargeRarity]}55 200deg, transparent 220deg)`,
                  }}
                />
                <div
                  className="gacha-anim-charge-sphere rounded-full"
                  style={{
                    width: 140, height: 140,
                    background: `radial-gradient(circle at 35% 30%, #fff, ${CHARGE_COLOR[chargeRarity]} 45%, ${CHARGE_COLOR[chargeRarity]}88 75%, transparent 100%)`,
                    boxShadow: `0 0 60px 20px ${CHARGE_COLOR[chargeRarity]}77`,
                  }}
                />
              </div>
            )}

            {phase === "explode" && (
              <>
                <div className="gacha-anim-flash absolute inset-0 bg-white pointer-events-none" />
                <div
                  className="gacha-anim-shockwave absolute rounded-full border-solid pointer-events-none"
                  style={{ width: 200, height: 200, borderColor: CHARGE_COLOR[chargeRarity] }}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/sprites/ui/gacha_burst.svg"
                  alt=""
                  className={`w-[70vmin] h-[70vmin] max-w-[700px] max-h-[700px] ${chargeRarity === "legendary" ? "gacha-anim-burst-legendary" : "gacha-anim-burst"}`}
                />
              </>
            )}

            {phase === "reveal" && (
              <>
                <div className="absolute inset-0">
                  {cardPositions(totalCount).map((pos, i) => {
                    const isFlipped = revealed.has(i);
                    const big = totalCount <= 1;
                    const dx = `${50 - pos.left}vw`;
                    const dy = `${46 - pos.top}vh`;
                    if (legendarySpotlight === i) return null;
                    return (
                      <div
                        key={i}
                        className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                        style={{
                          left: `${pos.left}%`,
                          top: `${pos.top}%`,
                          animationDelay: `${i * CARD_LAUNCH_STAGGER_MS}ms`,
                          animationName: "gacha-card-launch",
                          animationDuration: "0.55s",
                          animationTimingFunction: "cubic-bezier(0.2,0.7,0.3,1)",
                          animationFillMode: "both",
                          "--launch-dx": dx,
                          "--launch-dy": dy,
                          "--rot-from": `${pos.rotFrom}deg`,
                        } as React.CSSProperties}
                        onClick={() => flipCard(i)}
                      >
                        <div className={`gacha-flip-outer ${big ? "w-64 h-64" : "w-32 h-32"}`}>
                          <div className={`gacha-flip-inner ${isFlipped ? "is-flipped" : ""}`}>
                            {cardBack(big ? "w-64 h-64" : "w-32 h-32")}
                            {cardFront(results[i], big)}
                          </div>
                          {isFlipped && <div className="gacha-anim-shine absolute inset-0 pointer-events-none rounded-lg" style={{ background: "linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)" }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {legendarySpotlight !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <div
                      className="gacha-anim-legendary-beams absolute rounded-full pointer-events-none"
                      style={{ width: 500, height: 500, background: `conic-gradient(from 0deg, transparent, ${CHARGE_COLOR.legendary}33, transparent 15%, transparent 50%, ${CHARGE_COLOR.legendary}33, transparent 65%)` }}
                    />
                    <div className="gacha-anim-legendary-card">
                      <div className="w-56 h-56 rounded-lg border-4 border-military-gold gacha-anim-glow-legendary bg-military-darker flex flex-col items-center justify-center p-3 gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getEquipmentSprite(results[legendarySpotlight].equipmentId ?? "")} alt="" className="w-28 h-28 object-contain" />
                        <p className="text-military-gold font-black uppercase text-lg">Legendary</p>
                        <p className="text-white text-sm">{results[legendarySpotlight].equipmentName}</p>
                      </div>
                    </div>
                    <p className="gacha-anim-title absolute bottom-[20%] text-military-gold text-4xl font-black tracking-widest gacha-anim-glow-legendary">✨ LEGENDARY! ✨</p>
                  </div>
                )}

                {!allRevealed && legendarySpotlight === null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); revealAll(); }}
                    className="btn-gold text-sm px-6 py-2 absolute bottom-10"
                  >
                    Reveal All
                  </button>
                )}

                {allRevealed && summary && (
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 text-center">
                    <div className="gacha-anim-count flex items-center justify-center gap-4 mb-4 text-sm">
                      {RARITY_ORDER.filter((r) => summary.byRarity[r]).map((r) => (
                        <span key={r} className={`font-bold ${RARITY_COLOR[r]}`}>{summary.byRarity[r]}× {r}</span>
                      ))}
                      {summary.currency > 0 && <span className="text-military-gold font-bold">+{summary.currency}</span>}
                      {summary.dupes > 0 && <span className="text-green-400">{summary.dupes} upgraded</span>}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); closeReveal(); }} className="btn-military text-sm px-6 py-2">TAP TO CONTINUE</button>
                  </div>
                )}
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
                    onClick={() => pull(pool.poolId, currency, cost, balance)}
                    disabled={loading}
                    className="btn-gold flex-1 py-2"
                  >
                    {loading ? "..." : <span className="inline-flex items-center gap-1">Pull — <CurrencyCost currency={currency} amount={cost} /></span>}
                  </button>
                  <button
                    onClick={() => pullMulti(pool.poolId, currency, multiCost, balance)}
                    disabled={loading}
                    className="btn-gold flex-1 py-2"
                    title="10 independent pulls, 5% cheaper than 10x the single price"
                  >
                    {loading ? "..." : <span className="inline-flex items-center gap-1">x10 — <CurrencyCost currency={currency} amount={multiCost} /></span>}
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
