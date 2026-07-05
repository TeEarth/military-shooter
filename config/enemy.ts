export const ENEMY_CONFIG = {
  detectionRange: 300,
  lineOfSightRange: 350,
  coverWaitTime: 3000, // ms to wait behind cover
  alertDuration: 5000,
  // v4: every stat scales +10% compounding per 10-stage tier (tier = floor((stageNumber-1)/10)),
  // and enemy count grows by extraEnemiesPerTier per tier. See src/lib/stageTemplate.ts.
  difficultyScaling: {
    statMultiplierPerTier: 0.1,
    extraEnemiesPerTier: 1,
  },
} as const;
