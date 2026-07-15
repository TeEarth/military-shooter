export interface StageData {
  id: string;
  name: string;
  background: string;
  width: number;
  height: number;
  rewardCoin: number;
  rewardExp: number;
  isRepeatable: boolean;
  /** v11: real designed spawn point — 0 means "not designed", use the old default. */
  playerSpawnX?: number;
  playerSpawnY?: number;
  /** v29: per-boss minion summon cadence (see GameScene's spawnBossMinion) —
   *  only set for boss_* stages; defaults to 15000ms in GameScene when absent
   *  so Multiverse 1/2's bosses (no BossStage.summonIntervalMs configured)
   *  keep their existing cadence. */
  bossSummonIntervalMs?: number;
}
