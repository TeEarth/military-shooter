export interface PlayerStats {
  level: number;
  exp: number;
  coin: number;
  diamond: number;
  ticket: number;
  ammo: number;
  adsWatchedToday: number;
  currentStage: number;
}

export interface PlayerProfile {
  id: string;
  email: string;
  username: string;
  stats: PlayerStats;
  currentCharacter: string;
}

export interface GameSessionPlayer {
  hp: number;
  maxHp: number;
  armor: number;
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  isDead: boolean;
  x: number;
  y: number;
}
