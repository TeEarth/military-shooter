export const ENEMY_CONFIG = {
  detectionRange: 300,
  lineOfSightRange: 350,
  coverWaitTime: 3000, // ms to wait behind cover
  alertDuration: 5000,
  // v15: enemies felt passive/idle once they spotted the player — chase speed
  // was a flat 80px/s, about half the player's ~160px/s baseline, so a
  // retreating player could never be caught and enemies looked static.
  // patrolSpeed stays slow/leisurely; chaseSpeed is a determined pursuit once
  // the player is actually detected.
  patrolSpeed: 70,
  chaseSpeed: 150,
  // v4: every stat scales +10% compounding per 10-stage tier (tier = floor((stageNumber-1)/10)),
  // and enemy count grows by extraEnemiesPerTier per tier. See src/lib/stageTemplate.ts.
  difficultyScaling: {
    statMultiplierPerTier: 0.1,
    extraEnemiesPerTier: 1,
  },
} as const;
