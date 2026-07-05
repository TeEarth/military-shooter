"use client";

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
}

function stageNumber(stageId: string): number {
  return Number(stageId.replace(/\D/g, "")) || 0;
}

export default function StageSelectClient({ stages, currentStage, completedStageIds, boss }: Props) {
  const router = useRouter();

  const storyStages = stages.filter((s) => !s.isRepeatable);
  const farmStages = stages.filter((s) => s.isRepeatable);

  function handlePlay(stageId: string) {
    sfx.play("ui_click");
    router.push(`/game?stage=${stageId}`);
  }

  function renderCard(stage: StageRow) {
    const isCompleted = completedStageIds.includes(stage.id);
    const unlocked = stage.isRepeatable || stageNumber(stage.id) <= currentStage;
    const playable = unlocked && !isCompleted;

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
          {isCompleted && <span className="text-military-gold text-xs font-bold">✓ CLEARED</span>}
          {!unlocked && !isCompleted && <span className="text-military-steel text-xs">🔒</span>}
        </div>
        <h3 className="font-bold text-white mb-1">{stage.name}</h3>
        <div className="flex gap-3 text-xs text-military-steel">
          <span>📏 {stage.width}x{stage.height}</span>
          <span>🎖 {stage.rewardCoin} coins</span>
          <span>⭐ {stage.rewardExp} exp</span>
        </div>
        {isCompleted && <p className="text-military-steel text-xs mt-1">This mission has been cleared and cannot be replayed.</p>}
        {!stage.isRepeatable && !isCompleted && <p className="text-red-400 text-xs mt-1">Eliminate every enemy to clear — one attempt, no replays after clearing.</p>}
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Select Mission</h1>
      </div>

      {boss.available && (
        <div className="max-w-4xl mx-auto mb-6">
          <div
            className="card-military border-red-600 cursor-pointer hover:border-red-400 transition-all duration-200"
            onClick={() => handlePlay("boss_next")}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-red-400 text-xs font-bold">⚠ BOSS STAGE UNLOCKED</span>
            </div>
            <h3 className="font-bold text-white mb-1">Boss Encounter #{boss.encounterNumber}</h3>
            <p className="text-xs text-military-steel">HP: {boss.hp} — one rocket hit is instant death. Reward: 1 green banknote (Income tab).</p>
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
