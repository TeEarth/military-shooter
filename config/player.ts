/** Final on-screen pixel size for every character/enemy unit sprite (see PreloadScene.ts). */
export const UNIT_DISPLAY_SIZE = 48;

export const PLAYER_CONFIG = {
  invincibleFrames: 0.3, // seconds after taking damage
  respawnDelay: 2000, // ms
  maxLevel: 100,
  hitboxWidth: UNIT_DISPLAY_SIZE,
  hitboxHeight: UNIT_DISPLAY_SIZE,
  // Converts a character's raw "speed" stat (fixed at 8 for Azzure now, no longer
  // a special-cased outlier) into px/s. Reduced from 30 — movement felt too fast.
  speedMultiplier: 20,
  // HP regenerates by `regenPer5s` (from the Characters sheet) on a fixed tick,
  // independent of whether the player was just hit.
  hpRegenTickMs: 5000,
  // Bullet speed lives in config/game.ts (BASE_BULLET_SPEED / bulletSpeedForWeapon) —
  // v6 #13 unifies it across every weapon except sniper (x2) and grenade_launcher (/2).
  aoeRadius: 90,
  // v6 #10: temporary diagnostic — logs the player sprite's x/y/visible/active/alpha
  // every ~500ms specifically while playing Azzure, so the next time the
  // "character disappears" report happens we have real evidence (position out of
  // bounds? sprite destroyed? alpha/visible flipped off?) instead of guessing.
  // Safe to flip to false once the root cause is confirmed and fixed.
  debugAzzureLogging: true,
} as const;
