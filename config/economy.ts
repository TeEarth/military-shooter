export const ECONOMY_CONFIG = {
  // v4: everything starts at zero — new players have only Bob + Pistol (both
  // FREE unlockType) and must earn every other currency/character/weapon/
  // equipment themselves. Do not reintroduce a starting grant here.
  startingCoin: 0,
  startingDiamond: 0,
  startingTicket: 0,
  expPerLevel: (level: number) => Math.floor(100 * Math.pow(1.5, level - 1)),
} as const;
