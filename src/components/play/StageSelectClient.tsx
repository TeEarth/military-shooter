"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sfx } from "@/lib/sfx";

interface StageRow {
  id: string;
  name: string;
  background: string;
  width: number;
  height: number;
  rewardCoin: number;
  rewardExp: number;
  isRepeatable: boolean;
  multiverse: number;
  comingSoon: boolean;
}

interface BossStatus {
  available: boolean;
  encounterNumber: number;
  hp: number;
}

interface Props {
  stages: StageRow[];
  currentStage: number;
  completedStageIds: string[];
  boss: BossStatus;
  /** v17: highest multiverse unlocked so far — 1 + bosses defeated. */
  unlockedMultiverse: number;
}

function stageNumber(stageId: string): number {
  return Number(stageId.replace(/\D/g, "")) || 0;
}

export default function StageSelectClient({ stages, currentStage, completedStageIds, boss, unlockedMultiverse }: Props) {
  const router = useRouter();
  const multiverseNumbers = Array.from(new Set(stages.map((s) => s.multiverse))).sort((a, b) => a - b);
  const [selectedMultiverse, setSelectedMultiverse] = useState(1);

  const inThisMultiverse = stages.filter((s) => s.multiverse === selectedMultiverse);
  const storyStages = inThisMultiverse.filter((s) => !s.isRepeatable);
  const farmStages = inThisMultiverse.filter((s) => s.isRepeatable);

  function handlePlay(stageId: string) {
    sfx.play("ui_click");
    router.push(`/game?stage=${stageId}`);
  }

  function renderCard(stage: StageRow) {
    const isCompleted = completedStageIds.includes(stage.id);
    // v17: stage numbering is one continuous sequence across every multiverse
    // (stage11-20 for Multiverse 2, etc.) — currentStage alone would reach
    // stage11 the instant stage10 is cleared, before the boss fight, so
    // Multiverse 2+ needs the EXTRA unlockedMultiverse gate (tied to bosses
    // actually defeated) on top of the normal currentStage check.
    const unlocked = stage.isRepeatable || (stageNumber(stage.id) <= currentStage && stage.multiverse <= unlockedMultiverse);
    const playable = unlocked && !isCompleted && !stage.comingSoon;

    return (
      <div
        key={stage.id}
        className={`card-military transition-all duration-200 ${
          playable ? "cursor-pointer hover:border-military-tan" : "opacity-60 cursor-not-allowed"
        } ${stage.isRepeatable ? "border-green-700" : ""}`}
        onClick={() => playable && handlePlay(stage.id)}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-military-steel text-xs">{stage.isRepeatable ? "Repeatable" : `Stage ${stageNumber(stage.id)}`}</span>
          {stage.isRepeatable && <span className="text-green-400 text-xs font-bold">FARM</span>}
          {stage.comingSoon && <span className="text-military-gold text-xs font-bold">COMING SOON</span>}
          {isCompleted && <span className="text-military-gold text-xs font-bold">✓ CLEARED</span>}
          {!unlocked && !isCompleted && !stage.comingSoon && <span className="text-military-steel text-xs">🔒</span>}
        </div>
        <h3 className="font-bold text-white mb-1">{stage.name}</h3>
        <div className="flex gap-3 text-xs text-military-steel">
          <span>📏 {stage.width}x{stage.height}</span>
          <span>🎖 {stage.rewardCoin} coins</span>
          <span>⭐ {stage.rewardExp} exp</span>
        </div>
        {stage.comingSoon && <p className="text-military-steel text-xs mt-1">Stage layout not designed yet — check back soon.</p>}
        {isCompleted && <p className="text-military-steel text-xs mt-1">This mission has been cleared and cannot be replayed.</p>}
        {!stage.isRepeatable && !isCompleted && !stage.comingSoon && <p className="text-red-400 text-xs mt-1">Eliminate every enemy to clear — one attempt, no replays after clearing.</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Select Mission</h1>
      </div>

      {multiverseNumbers.length > 1 && (
        <div className="flex gap-2 mb-6 max-w-4xl mx-auto">
          {multiverseNumbers.map((mv) => {
            const unlocked = mv <= unlockedMultiverse;
            const isNew = unlocked && mv === unlockedMultiverse && mv > 1;
            return (
              <button
                key={mv}
                onClick={() => unlocked && setSelectedMultiverse(mv)}
                disabled={!unlocked}
                className={`btn-military text-xs relative ${selectedMultiverse === mv ? "" : "opacity-50"} ${!unlocked ? "cursor-not-allowed" : ""}`}
              >
                {unlocked ? `Multiverse ${mv}` : `🔒 Multiverse ${mv}`}
                {isNew && <span className="absolute -top-2 -right-2 bg-military-gold text-military-darker text-[9px] font-bold px-1 rounded">NEW</span>}
              </button>
            );
          })}
        </div>
      )}

      {boss.available && selectedMultiverse === 1 && (
        <div className="max-w-4xl mx-auto mb-6">
          <div
            className="card-military border-red-600 cursor-pointer hover:border-red-400 transition-all duration-200"
            onClick={() => handlePlay("boss_next")}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-red-400 text-xs font-bold">⚠ BOSS STAGE UNLOCKED</span>
            </div>
            <h3 className="font-bold text-white mb-1">Boss Encounter #{boss.encounterNumber}</h3>
            <p className="text-xs text-military-steel">
              HP: {boss.hp} — dual-wields Double Pistol and calls in a fresh pistol reinforcement every minute. No cover on this map.
              Reward: 500 coin, 50 diamond, 10 ticket, 1 green banknote. Clearing it unlocks the next Multiverse.
            </p>
          </div>
        </div>
      )}

      <h2 className="text-military-tan text-sm uppercase tracking-wider mb-3 max-w-4xl mx-auto">Story missions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
        {storyStages.map(renderCard)}
      </div>

      {farmStages.length > 0 && (
        <>
          <h2 className="text-green-400 text-sm uppercase tracking-wider mb-3 max-w-4xl mx-auto">Farm missions — always unlocked, repeat freely</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {farmStages.map(renderCard)}
          </div>
        </>
      )}
    </div>
  );
}
