import type { CapacitorConfig } from "@capacitor/cli";

// v31: wraps the LIVE Vercel deployment in a native WebView shell instead of
// bundling a static export — this app is a full Next.js server app (19+ API
// routes, session auth, server components), none of which survives a static
// export. Pointing `server.url` at the real deployment means every code
// change pushed to Vercel shows up in the store app immediately on next
// launch, with zero app-store resubmission needed — resubmission is only
// required when the native shell ITSELF changes (icon, app name, a new
// native plugin like IAP or AdMob).
const config: CapacitorConfig = {
  appId: "com.militaryshooter.game",
  appName: "Military Shooter 2D",
  webDir: "public",
  server: {
    url: "https://military-shooter-kappa.vercel.app",
    androidScheme: "https",
    cleartext: false,
  },
};

export default config;
