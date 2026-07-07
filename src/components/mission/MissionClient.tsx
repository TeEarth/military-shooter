"use client";

import { useState } from "react";
import Link from "next/link";
import { sfx } from "@/lib/sfx";
import CurrencyBar from "@/components/ui/CurrencyBar";

interface MissionWithProgress {
  id: string;
  type: "daily" | "personal";
  description: string;
  rewardCoin: number;
  rewardExp: number;
  rewardDiamond: number;
  targetValue: number;
  progress: number;
  claimed: boolean;
}

interface MilestoneInfo {
  stagesCleared: number;
  milestonesEarned: number;
  nextMilestoneAt: number;
}

export default function MissionClient({ missions: initialMissions, milestone, coin: initialCoin, diamond: initialDiamond, ticket, exp: initialExp, greenBanknote }: { missions: MissionWithProgress[]; milestone: MilestoneInfo; coin: number; diamond: number; ticket: number; exp: number; greenBanknote: number }) {
  const [missions, setMissions] = useState(initialMissions);
  const [coin, setCoin] = useState(initialCoin);
  const [diamond, setDiamond] = useState(initialDiamond);
  const [exp, setExp] = useState(initialExp);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const daily = missions.filter((m) => m.type === "daily");
  const personal = missions.filter((m) => m.type === "personal");

  async function claim(missionId: string) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    try {
      const res = await fetch("/api/mission", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (data.success) {
        sfx.play("pickup_coin");
        setMissions((prev) => prev.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)));
        setCoin((c) => c + data.rewardCoin);
        setDiamond((d) => d + data.rewardDiamond);
        setExp((e) => e + data.rewardExp);
        const diamondPart = data.rewardDiamond > 0 ? `, +${data.rewardDiamond} 💎` : "";
        setMessage(`+${data.rewardCoin} coins, +${data.rewardExp} exp${diamondPart}`);
      } else {
        setMessage(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  function renderMission(m: MissionWithProgress) {
    const complete = m.progress >= m.targetValue;
    return (
      <div key={m.id} className={`card-military ${complete && !m.claimed ? "border-military-tan" : ""}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-bold text-sm">{m.description}</p>
            <p className="text-xs text-military-steel mt-1">Progress: {Math.min(m.progress, m.targetValue)}/{m.targetValue}</p>
          </div>
          <span className="text-military-gold text-xs">
            +{m.rewardCoin} 🪙 +{m.rewardExp} exp{m.rewardDiamond > 0 ? ` +${m.rewardDiamond} 💎` : ""}
          </span>
        </div>
        <div className="h-2 bg-military-darker border border-military-steel mt-2 mb-2">
          <div className="h-full bg-military-tan" style={{ width: `${Math.min(100, (m.progress / m.targetValue) * 100)}%` }} />
        </div>
        {m.claimed ? (
          <span className="text-green-400 text-xs font-bold">✓ CLAIMED</span>
        ) : complete ? (
          <button onClick={() => claim(m.id)} disabled={loading} className="btn-military text-xs">CLAIM</button>
        ) : (
          <span className="text-military-steel text-xs">In progress</span>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Missions</h1>
        <div className="ml-auto">
          <CurrencyBar coin={coin} diamond={diamond} ticket={ticket} greenBanknote={greenBanknote} />
        </div>
      </div>

      {message && <div className="max-w-2xl mx-auto mb-4 text-military-gold text-sm">{message}</div>}

      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-military-tan text-sm uppercase tracking-wider mb-3">Daily</h2>
          <div className="space-y-3">
            {daily.map(renderMission)}
            {daily.length === 0 && <p className="text-military-steel text-sm">No daily missions configured yet.</p>}
          </div>
        </div>
        <div>
          <h2 className="text-military-tan text-sm uppercase tracking-wider mb-3">Personal</h2>
          <div className="space-y-3">
            {personal.map(renderMission)}
            {personal.length === 0 && <p className="text-military-steel text-sm">No personal missions configured yet.</p>}
          </div>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Stage Milestones</h2>
          <p className="text-xs text-military-steel">
            Every 5 story stages cleared grants +10 💎 automatically (no claim needed) — forever, no cap.
          </p>
          <p className="text-sm mt-2">Stages cleared: <span className="text-white font-bold">{milestone.stagesCleared}</span></p>
          <p className="text-sm">Milestones earned: <span className="text-military-gold font-bold">{milestone.milestonesEarned}</span></p>
          <p className="text-sm">Next milestone at stage: <span className="text-white font-bold">{milestone.nextMilestoneAt}</span></p>
        </div>
      </div>
    </div>
  );
}
