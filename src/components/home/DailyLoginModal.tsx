"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { sfx } from "@/lib/sfx";
import { DAILY_LOGIN_REWARDS } from "@/lib/dailyLoginRewards";

interface DailyLoginStatus {
  nextClaimDay: number;
  alreadyClaimedToday: boolean;
  lastClaimedDay: number;
}

interface ClaimResult {
  day: number;
  rewardDiamond: number;
  rewardTicket: number;
  gachaResult?: {
    rewardType: "equipment" | "currency";
    rarity?: string;
    equipmentName?: string;
    isDupe?: boolean;
    rewardCurrency?: "coin" | "diamond";
    rewardAmount?: number;
  };
}

const RARITY_COLOR: Record<string, string> = {
  common: "text-gray-300",
  rare: "text-blue-400",
  epic: "text-purple-400",
  legendary: "text-military-gold",
};

function dayStatus(day: number, status: DailyLoginStatus): "claimed" | "today" | "upcoming" {
  if (day <= status.lastClaimedDay) return "claimed";
  if (day === status.nextClaimDay && !status.alreadyClaimedToday) return "today";
  return "upcoming";
}

/** v66: the auto-popup Daily Login Reward window — HomeClient decides WHEN
 *  to render this (auto-open on mount if unclaimed, or manually via the
 *  small calendar button); this component only owns the claim flow itself.
 *  Reuses the Gacha reveal's existing CSS keyframes (gacha-anim-*) for the
 *  grand-reward glow/beams instead of writing a whole new animation set. */
export default function DailyLoginModal({
  initialStatus,
  onClose,
  onClaimed,
}: {
  initialStatus: DailyLoginStatus;
  onClose: () => void;
  onClaimed: (updatedPlayer: { coin: number; diamond: number; ticket: number }, claimedDay: number) => void;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState("");

  const day7Status = dayStatus(7, status);

  async function handleClaim() {
    if (claiming || status.alreadyClaimedToday) return;
    setClaiming(true);
    setError("");
    sfx.play("ui_click");
    try {
      const res = await fetch("/api/daily-login/claim", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Claim failed.");
        sfx.play("miss");
        return;
      }
      const result = data.result as ClaimResult;
      setClaimResult(result);
      setStatus({ nextClaimDay: result.day, alreadyClaimedToday: true, lastClaimedDay: result.day });
      if (data.updatedPlayer) onClaimed(data.updatedPlayer, result.day);
      sfx.play(result.day === 7 ? "gacha_legendary" : "pickup_coin");
    } catch {
      setError("Network error — reward not claimed.");
      sfx.play("miss");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-[200] p-4 gacha-anim-overlay" onClick={onClose}>
      <div className="card-military max-w-lg w-full relative border-2 border-military-gold" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-2 right-2 text-military-steel hover:text-white">
          <Icon name="close" size={20} />
        </button>

        {!claimResult ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Icon name="calendar" size={26} />
              <h2 className="text-lg font-black text-military-gold uppercase tracking-widest">Daily Login Reward</h2>
            </div>
            <p className="text-xs text-military-steel mb-4">Log in every day for a reward — miss a day and your progress just waits for you, it never resets.</p>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
              {DAILY_LOGIN_REWARDS.filter((r) => r.day !== 7).map((r) => {
                const st = dayStatus(r.day, status);
                return (
                  <div
                    key={r.day}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded border ${
                      st === "today"
                        ? "border-military-gold bg-military-dark animate-pulse"
                        : st === "claimed"
                          ? "border-emerald-600 bg-military-darker opacity-80"
                          : "border-military-steel bg-military-darker opacity-50"
                    }`}
                  >
                    <span className="text-[9px] text-military-steel uppercase">Day {r.day}</span>
                    <Icon name={r.icon} size={24} />
                    <span className="text-[9px] font-bold text-white text-center leading-tight">{r.label}</span>
                    {st === "claimed" && <span className="absolute -top-1 -right-1 bg-emerald-500 rounded-full w-4 h-4 flex items-center justify-center"><Icon name="check" size={10} /></span>}
                    {st === "today" && <span className="text-[8px] text-military-gold font-bold uppercase">Today</span>}
                  </div>
                );
              })}
            </div>

            {/* v66: Day 7 grand reward — deliberately bigger/more decorated
             *  than days 1-6 (large box, gold border, glow, beams, big gacha
             *  icon), per request. */}
            <div
              className={`relative overflow-hidden rounded border-2 p-4 flex items-center gap-4 mb-4 bg-gradient-to-br from-military-dark to-black ${
                day7Status === "today" ? "border-military-gold gacha-anim-glow-legendary" : day7Status === "claimed" ? "border-emerald-600" : "border-military-steel opacity-60"
              }`}
            >
              {day7Status === "today" && (
                <div
                  className="absolute inset-0 pointer-events-none gacha-anim-legendary-beams"
                  style={{ background: "conic-gradient(from 0deg, transparent, #ffd76a33, transparent 15%, transparent 50%, #ffd76a33, transparent 65%)" }}
                />
              )}
              <div className="relative flex-shrink-0"><Icon name="gacha" size={56} /></div>
              <div className="relative min-w-0 flex-1">
                <p className="text-military-gold font-black uppercase tracking-widest text-sm">Day 7 — Grand Reward</p>
                <p className="text-xs text-military-steel">A free Gacha pull from the Diamond Pool</p>
              </div>
              {day7Status === "claimed" && <Icon name="check" size={22} className="relative text-emerald-400" />}
              {day7Status === "today" && <span className="relative text-[10px] text-military-gold font-bold uppercase animate-pulse">Today!</span>}
            </div>

            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

            {status.alreadyClaimedToday ? (
              <p className="text-center text-emerald-400 text-sm font-bold">✓ Today's reward already claimed — come back tomorrow.</p>
            ) : (
              <button onClick={handleClaim} disabled={claiming} className="btn-gold w-full py-3">
                {claiming ? "..." : "CLAIM"}
              </button>
            )}
          </>
        ) : (
          <div className="text-center py-4">
            {claimResult.day === 7 ? (
              <>
                <div className="relative w-24 h-24 mx-auto mb-3 gacha-anim-item">
                  <div className="absolute inset-0 gacha-anim-glow-legendary rounded-full" style={{ boxShadow: "0 0 40px 10px #ffd76a88" }} />
                  <Icon name="gacha" size={96} />
                </div>
                <p className="text-military-gold font-black uppercase tracking-widest text-lg mb-1">✨ Grand Reward! ✨</p>
                {claimResult.gachaResult?.rewardType === "equipment" ? (
                  <p className={`font-bold ${RARITY_COLOR[claimResult.gachaResult.rarity ?? "common"]}`}>
                    {claimResult.gachaResult.equipmentName} ({claimResult.gachaResult.rarity}){claimResult.gachaResult.isDupe ? " — upgraded!" : ""}
                  </p>
                ) : (
                  <p className="font-bold text-white inline-flex items-center justify-center gap-1">
                    +{claimResult.gachaResult?.rewardAmount} <Icon name={claimResult.gachaResult?.rewardCurrency === "diamond" ? "diamond" : "coin"} size={16} />
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto mb-3" style={{ animation: "pvp-pay-flourish 0.5s ease-out" }}>
                  <Icon name={claimResult.rewardDiamond > 0 ? "diamond" : "ticket"} size={80} />
                </div>
                <p className="text-military-gold font-black uppercase tracking-widest text-lg mb-1">Reward Claimed!</p>
                <p className="font-bold text-white inline-flex items-center justify-center gap-1">
                  +{claimResult.rewardDiamond > 0 ? claimResult.rewardDiamond : claimResult.rewardTicket}{" "}
                  <Icon name={claimResult.rewardDiamond > 0 ? "diamond" : "ticket"} size={16} />
                </p>
              </>
            )}
            <button onClick={onClose} className="btn-military w-full py-2 mt-5">CONTINUE</button>
          </div>
        )}
      </div>
    </div>
  );
}
