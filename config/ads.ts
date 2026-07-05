// Ads configuration - swap provider here without touching game code
export const ADS_CONFIG = {
  provider: "mock" as "mock" | "admob" | "unity",
  rewardedAd: {
    ammoReward: 30,
    maxPerDay: 5,
    // AdMob config (fill when switching provider)
    admob: {
      adUnitId: "",
      appId: "",
    },
    // Unity Ads config
    unity: {
      gameId: "",
      placementId: "rewardedVideo",
    },
  },
  // Mock ad duration in ms (for development)
  mockAdDuration: 3000,
};

export type AdsProvider = typeof ADS_CONFIG.provider;
