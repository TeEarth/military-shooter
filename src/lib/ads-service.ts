import { ADS_CONFIG } from "../../config/ads";

export interface AdResult {
  success: boolean;
  reward?: number;
  error?: string;
}

async function showMockAd(): Promise<AdResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ success: true, reward: ADS_CONFIG.rewardedAd.ammoReward });
    }, ADS_CONFIG.mockAdDuration);
  });
}

async function showAdMobAd(): Promise<AdResult> {
  // TODO: Integrate Google AdMob SDK
  // const ad = await window.admob.requestRewardedAd(ADS_CONFIG.rewardedAd.admob.adUnitId);
  // await ad.show();
  return { success: false, error: "AdMob not configured" };
}

async function showUnityAd(): Promise<AdResult> {
  // TODO: Integrate Unity Ads SDK
  // await UnityAds.showRewardedAd(ADS_CONFIG.rewardedAd.unity.placementId);
  return { success: false, error: "Unity Ads not configured" };
}

export async function showRewardedAd(): Promise<AdResult> {
  switch (ADS_CONFIG.provider) {
    case "admob":
      return showAdMobAd();
    case "unity":
      return showUnityAd();
    case "mock":
    default:
      return showMockAd();
  }
}
