export const ENEMY_CONFIG = {
  // v16: enemies can shoot at ANY range now (no more lineOfSightRange cap) —
  // detectionRange is the only gate left, and it now controls just one thing:
  // whether the enemy actively CHASES to close the gap. Outside detection
  // range they stand their ground and snipe from a distance instead of doing
  // nothing, matching "enemy can attack at long range same as before, just
  // doesn't come after you until you're within its detection radius."
  detectionRange: 300,
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
