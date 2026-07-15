/**
 * v30 migration: real Multiverse 2 (stage11-19) enemy positions + cover
 * layout, replacing migrate-v20's random-scatter placeholder data.
 *
 * The user provided the actual stage-layout PDF/images for stage11-20 (the
 * same source migrate-v27 used for stage20's wall/crate layout and the
 * stage11-20 rename) — migrate-v27's own comment incorrectly assumed
 * stage11-19 "show only enemy-position circles with no cover icons", but the
 * images actually draw fixed bush/crate/house cover for every one of those
 * stages too. Combined with migrate-v20's enemy positions being seeded
 * *random* (never replaced with the PDF's real layout), this is why the user
 * reported stage11-20 "doesn't match at all" — every stage in Multiverse 2
 * has been showing a randomly-generated arena, not the one actually designed.
 *
 * This migration:
 * - Deletes migrate-v20's random StageEnemy rows for stage11-19 and replaces
 *   them with real positions read off the layout images (numbered circles:
 *   6=enemy_turret, 7=enemy_double_pistol, 8=enemy_m16a4,
 *   9=enemy_grenade_launcher, 10=enemy_rasor_gun — see the PDF's own legend
 *   page). Coordinates are scaled from the images (2000x1125 reference
 *   frame) to the game's 1280x720 arena.
 * - Adds StageCover rows for stage11-19 (bush clusters -> "tree", wooden
 *   crates -> "crate", houses -> "house") — previously stage11-19 had NO
 *   StageCover rows at all, so GameScene's random-scatter cover fallback ran
 *   instead of the PDF's fixed layout.
 * - Updates each stage's playerSpawnX/Y to the real spawn point (green
 *   circle) from its image, replacing migrate-v20's random spawn.
 * - stage20 is untouched — migrate-v27 already gave it real cover, and its
 *   enemy positions are addressed separately if ever revisited.
 *
 * Run with: npx tsx scripts/migrate-v30.ts
 */
import "dotenv/config";
import { readSheetRaw, updateRow, appendRows, deleteRowsWhere } from "../src/lib/google/sheet";

const ENEMY_BY_TYPE: Record<number, string> = {
  6: "enemy_turret",
  7: "enemy_double_pistol",
  8: "enemy_m16a4",
  9: "enemy_grenade_launcher",
  10: "enemy_rasor_gun",
};

interface StageLayout {
  spawn: [number, number];
  enemies: [number, number, number][]; // x, y, type
  cover: { type: "tree" | "crate" | "house"; points: [number, number][] };
}

const LAYOUTS: Record<string, StageLayout> = {
  stage11: {
    spawn: [61, 665],
    enemies: [[276, 127, 7], [864, 192, 7], [1087, 99, 6], [531, 350, 7], [941, 422, 7]],
    cover: { type: "tree", points: [[746, 69], [886, 69], [483, 182], [1158, 205], [198, 390], [781, 349], [1168, 301], [541, 556], [1098, 563]] },
  },
  stage12: {
    spawn: [61, 665],
    enemies: [[844, 76, 6], [979, 158, 6], [1068, 244, 6], [1176, 329, 6], [496, 260, 7], [712, 424, 7]],
    cover: { type: "tree", points: [[318, 104], [616, 104], [191, 260], [801, 299], [479, 398], [1029, 485], [667, 690]] },
  },
  stage13: {
    spawn: [1124, 595],
    enemies: [[206, 131, 7], [746, 84, 7], [291, 339, 7], [496, 260, 7], [786, 259, 7], [77, 416, 7], [513, 499, 7], [250, 576, 7], [709, 424, 7], [776, 646, 7]],
    cover: { type: "crate", points: [[463, 99], [1183, 98], [320, 173], [648, 165], [941, 170], [152, 274], [648, 291], [397, 403], [608, 442], [939, 376], [399, 604], [826, 542], [973, 532], [630, 646]] },
  },
  stage14: {
    spawn: [312, 112],
    enemies: [[1024, 222, 8], [1178, 330, 8], [146, 542, 6], [672, 456, 8], [509, 595, 8]],
    cover: { type: "crate", points: [[469, 99], [1123, 86], [165, 346], [845, 288], [524, 413], [291, 690], [928, 646]] },
  },
  stage15: {
    spawn: [619, 96],
    enemies: [[1149, 353, 8], [146, 544, 8], [1171, 581, 8], [549, 573, 9], [655, 560, 9], [768, 581, 9]],
    cover: { type: "crate", points: [[342, 170], [557, 228], [867, 138], [1030, 243], [147, 346], [384, 354], [722, 381], [946, 424], [291, 546], [54, 690]] },
  },
  stage16: {
    spawn: [611, 342],
    enemies: [[541, 72, 8], [755, 92, 8], [966, 114, 8], [128, 348, 8], [1162, 348, 8], [568, 643, 8], [847, 609, 8], [970, 360, 10]],
    cover: { type: "crate", points: [[509, 253], [582, 236], [643, 242], [717, 266], [719, 339], [672, 392], [613, 416], [549, 419], [339, 511]] },
  },
  stage17: {
    spawn: [605, 352],
    enemies: [[287, 90, 8], [925, 98, 6], [1123, 77, 10], [1157, 165, 10], [1117, 312, 6], [90, 472, 9], [242, 602, 7], [575, 629, 7], [854, 611, 8], [1101, 614, 10]],
    cover: { type: "tree", points: [[659, 95], [397, 186], [147, 205], [570, 245], [851, 192], [413, 326], [810, 330], [291, 453], [522, 477], [739, 472], [998, 474], [370, 611], [688, 640]] },
  },
  stage18: {
    spawn: [1206, 646],
    enemies: [[421, 92, 10], [122, 146, 10], [284, 338, 10], [111, 546, 10]],
    cover: { type: "crate", points: [[336, 214], [574, 165], [522, 266], [434, 379], [289, 511], [952, 88], [797, 291], [1011, 488], [1123, 464], [772, 494], [528, 536], [767, 648], [221, 655]] },
  },
  stage19: {
    spawn: [1206, 646],
    enemies: [[122, 117, 6], [442, 611, 6], [442, 309, 9], [90, 453, 9], [421, 92, 10], [741, 179, 7], [805, 179, 7], [754, 397, 8], [805, 434, 8], [774, 562, 9]],
    cover: { type: "house", points: [[250, 255], [246, 378], [246, 500], [246, 624], [595, 72], [595, 195], [595, 319], [595, 442], [924, 255], [924, 378], [924, 500], [924, 624]] },
  },
};

async function main() {
  const stageIds = Object.keys(LAYOUTS);

  // ---------- 1. Replace random StageEnemy rows with real positions ----------
  const removed = await deleteRowsWhere("StageEnemy", (r) => stageIds.includes(r.stageId));
  console.log(`  Removed ${removed} old (random) StageEnemy rows for stage11-19`);

  const newEnemyRows: Record<string, string | number>[] = [];
  for (const [stageId, layout] of Object.entries(LAYOUTS)) {
    for (const [x, y, type] of layout.enemies) {
      const enemyId = ENEMY_BY_TYPE[type];
      if (!enemyId) throw new Error(`Unknown enemy type ${type} for ${stageId}`);
      newEnemyRows.push({ stageId, enemyId, spawnX: x, spawnY: y });
    }
  }
  await appendRows("StageEnemy", newEnemyRows);
  console.log(`  Added ${newEnemyRows.length} real StageEnemy rows for stage11-19`);

  // ---------- 2. Add real StageCover rows (previously none for stage11-19) ----------
  const { rows: existingCovers } = await readSheetRaw("StageCover");
  const newCoverRows: Record<string, string | number>[] = [];
  for (const [stageId, layout] of Object.entries(LAYOUTS)) {
    if (existingCovers.some((r) => r.stageId === stageId)) {
      console.log(`  ${stageId} StageCover rows already present, skipping`);
      continue;
    }
    for (const [x, y] of layout.cover.points) {
      newCoverRows.push({ stageId, coverType: layout.cover.type, x, y, rotation: 0 });
    }
  }
  if (newCoverRows.length > 0) {
    await appendRows("StageCover", newCoverRows);
    console.log(`  Added ${newCoverRows.length} StageCover rows for stage11-19`);
  }

  // ---------- 3. Real player spawn points ----------
  const { rows: stageRows } = await readSheetRaw("Stage");
  for (const [stageId, layout] of Object.entries(LAYOUTS)) {
    const idx = stageRows.findIndex((r) => r.id === stageId);
    if (idx === -1) {
      console.warn(`  ${stageId} not found in Stage sheet, skipping spawn update`);
      continue;
    }
    await updateRow("Stage", idx, { playerSpawnX: layout.spawn[0], playerSpawnY: layout.spawn[1] });
  }
  console.log(`  Updated playerSpawnX/Y for stage11-19`);

  console.log("\nMigration v30 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
