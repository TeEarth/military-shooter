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
}
