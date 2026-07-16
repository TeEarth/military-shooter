const sharp = require("sharp");
const path = require("path");

const RES = path.join(__dirname, "..", "android", "app", "src", "main", "res");
const MASTER = path.join(__dirname, "..", "public", "assets", "icon", "app_icon_master.svg");
const FOREGROUND = path.join(__dirname, "..", "public", "assets", "icon", "app_icon_foreground.svg");

const DENSITIES = {
  mdpi: { launcher: 48, foreground: 108 },
  hdpi: { launcher: 72, foreground: 162 },
  xhdpi: { launcher: 96, foreground: 216 },
  xxhdpi: { launcher: 144, foreground: 324 },
  xxxhdpi: { launcher: 192, foreground: 432 },
};

async function main() {
  for (const [density, sizes] of Object.entries(DENSITIES)) {
    const dir = path.join(RES, `mipmap-${density}`);
    await sharp(MASTER).resize(sizes.launcher, sizes.launcher).png().toFile(path.join(dir, "ic_launcher.png"));
    await sharp(MASTER).resize(sizes.launcher, sizes.launcher).png().toFile(path.join(dir, "ic_launcher_round.png"));
    await sharp(FOREGROUND).resize(sizes.foreground, sizes.foreground).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
    console.log(`  ${density}: launcher=${sizes.launcher} foreground=${sizes.foreground}`);
  }

  // Play Store listing icon (512x512, full square, no transparency needed).
  const playStoreDir = path.join(__dirname, "..", "public", "assets", "icon");
  await sharp(MASTER).resize(512, 512).png().toFile(path.join(playStoreDir, "playstore_icon_512.png"));

  console.log("Done generating Android icons.");
}

main().catch((e) => { console.error(e); process.exit(1); });
