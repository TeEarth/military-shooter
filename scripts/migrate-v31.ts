/**
 * v31 migration: PRECISE stage11-20 enemy/cover positions, replacing v30's
 * eyeball-estimated coordinates (the user reported those still didn't match
 * the PDF, including stage20's wall rows).
 *
 * This time positions were extracted programmatically instead of estimated
 * by eye: each stage-layout PNG (from the user's reference zip) was run
 * through OpenCV color/connected-component detection for the enemy circles
 * (exact pixel centroid per marker) and the green spawn point, template
 * matching against cropped reference icons for crate/bush/house/wall
 * cover, and the enemy TYPE NUMBER inside each circle was read by matching
 * against the PDF's own legend-page digit glyphs (not OCR — tesseract
 * wasn't available in this environment, so the legend page's actual "1".."10"
 * renders were used as ground-truth templates instead). Pixel coordinates
 * were then scaled from the source image's 2667x1500 frame to the game's
 * 1280x720 arena.
 *
 * stage20 additionally gets real wall-segment positions this time (the user
 * specifically flagged "กำแพงก็ยังไม่ตรง" — the walls didn't match either) —
 * template-matched against a cropped wall-block icon, de-duplicated from a
 * double-detection artifact (the template width was ~half a block, so every
 * block matched twice at 50% overlap; every other detection was discarded to
 * recover the true one-per-block spacing).
 *
 * Run with: npx tsx scripts/migrate-v31.ts
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
  crate: [number, number][];
  bush: [number, number][];
  house: [number, number][];
  wall: [number, number][];
}

const LAYOUTS: Record<string, StageLayout> = {
  stage11: {
    spawn: [60, 666],
    enemies: [[1090, 100, 6], [277, 129, 7], [866, 194, 7], [536, 351, 7], [943, 424, 7]],
    crate: [],
    bush: [[745, 69], [888, 69], [1167, 208], [208, 390], [1181, 301], [1111, 565], [782, 348], [494, 180], [555, 556]],
    house: [],
    wall: [],
  },
  stage12: {
    spawn: [60, 666],
    enemies: [[845, 77, 6], [971, 160, 6], [1076, 245, 6], [498, 262, 7], [1181, 330, 6], [713, 426, 7]],
    crate: [],
    bush: [[677, 619], [1040, 483], [195, 271], [483, 399], [808, 299], [616, 107], [325, 102]],
    house: [],
    wall: [],
  },
  stage13: {
    spawn: [1127, 595],
    enemies: [[747, 85, 7], [207, 132, 7], [498, 262, 7], [790, 262, 7], [290, 342, 7], [78, 417, 7], [713, 426, 7], [518, 502, 7], [253, 578, 7], [777, 635, 7]],
    crate: [[463, 99], [403, 589], [392, 399], [940, 370], [647, 153], [1159, 96], [616, 437], [1009, 531], [323, 171], [642, 635], [176, 475], [940, 166], [655, 288], [832, 542], [151, 273]],
    bush: [],
    house: [],
    wall: [],
  },
  stage14: {
    spawn: [312, 113],
    enemies: [[1014, 225, 8], [1181, 331, 8], [1094, 444, 6], [673, 458, 8], [145, 545, 6], [509, 594, 8]],
    crate: [[926, 613], [530, 411], [1126, 83], [285, 610], [177, 341], [857, 284], [469, 99]],
    bush: [[674, 223], [677, 619], [369, 496], [311, 249], [1138, 590], [888, 427]],
    house: [],
    wall: [],
  },
  stage15: {
    spawn: [622, 97],
    enemies: [[1156, 354, 8], [145, 546, 8], [658, 561, 9], [552, 574, 9], [779, 585, 9], [1183, 592, 8]],
    crate: [[566, 226], [393, 351], [147, 341], [82, 641], [971, 424], [288, 548], [340, 169], [724, 379], [873, 119], [1043, 240]],
    bush: [[505, 485], [383, 511], [1015, 573], [777, 483], [643, 455], [901, 524]],
    house: [],
    wall: [],
  },
  stage16: {
    spawn: [611, 342],
    enemies: [[542, 84, 8], [759, 102, 8], [960, 116, 8], [128, 350, 8], [959, 361, 10], [1156, 354, 8], [856, 607, 8], [578, 631, 8]],
    crate: [[526, 264], [572, 408], [82, 641], [340, 509], [592, 245], [715, 280], [655, 258], [640, 417], [715, 339], [700, 396]],
    bush: [[862, 512], [1147, 103], [868, 217], [400, 206], [464, 456], [159, 112], [217, 585], [1080, 634]],
    house: [],
    wall: [],
  },
  stage17: {
    spawn: [607, 352],
    enemies: [[1121, 80, 10], [286, 91, 8], [927, 99, 6], [1133, 314, 6], [92, 476, 9], [242, 598, 7], [856, 607, 8], [1114, 615, 10], [578, 631, 7]],
    crate: [],
    bush: [[1159, 168], [812, 329], [296, 451], [523, 479], [701, 627], [150, 212], [424, 323], [670, 93], [604, 245], [860, 195], [744, 471], [989, 471], [366, 600], [406, 181]],
    house: [],
    wall: [],
  },
  stage18: {
    spawn: [1207, 632],
    enemies: [[1121, 80, 10], [421, 93, 10], [122, 148, 10], [747, 160, 10], [285, 337, 10], [113, 547, 10], [623, 633, 10]],
    crate: [[311, 212], [763, 618], [226, 652], [798, 290], [969, 465], [540, 532], [939, 88], [587, 163], [541, 280], [1124, 280], [1145, 456], [733, 485], [82, 307], [287, 514], [438, 372]],
    bush: [],
    house: [],
    wall: [],
  },
  stage19: {
    spawn: [1207, 632],
    enemies: [[421, 93, 10], [122, 118, 6], [740, 181, 7], [806, 183, 7], [440, 311, 9], [749, 401, 8], [806, 439, 8], [93, 456, 9], [774, 566, 9], [447, 620, 6], [97, 651, 10]],
    crate: [],
    bush: [],
    house: [[601, 198], [250, 254], [247, 375], [250, 504], [250, 624], [917, 256], [924, 503], [611, 330], [919, 377], [612, 460], [929, 628], [598, 80]],
    wall: [],
  },
  stage20: {
    spawn: [1207, 632],
    enemies: [[595, 77, 6], [250, 153, 10], [595, 181, 6], [408, 199, 9], [124, 384, 8], [215, 430, 8], [1095, 490, 7], [690, 501, 7], [218, 512, 8], [410, 522, 7], [566, 583, 7], [433, 598, 7]],
    crate: [[108, 626], [558, 654], [1217, 480], [847, 494]],
    bush: [[1190, 57], [99, 513], [298, 612], [720, 640], [546, 495], [956, 495]],
    house: [[112, 137]],
    wall: [
      [54, 265], [157, 265], [257, 265], [357, 265], [457, 265], [557, 265], [659, 265], [759, 265], [859, 265], [959, 265],
      [323, 394], [426, 394], [526, 394], [626, 394], [726, 394], [826, 394], [928, 394], [1029, 394], [1128, 394], [1228, 394],
    ],
  },
};

async function main() {
  const stageIds = Object.keys(LAYOUTS);

  // ---------- 1. Replace StageEnemy rows with precise positions ----------
  const removedEnemies = await deleteRowsWhere("StageEnemy", (r) => stageIds.includes(r.stageId));
  console.log(`  Removed ${removedEnemies} old StageEnemy rows for stage11-20`);

  const newEnemyRows: Record<string, string | number>[] = [];
  for (const [stageId, layout] of Object.entries(LAYOUTS)) {
    for (const [x, y, type] of layout.enemies) {
      const enemyId = ENEMY_BY_TYPE[type];
      if (!enemyId) throw new Error(`Unknown enemy type ${type} for ${stageId}`);
      newEnemyRows.push({ stageId, enemyId, spawnX: x, spawnY: y });
    }
  }
  await appendRows("StageEnemy", newEnemyRows);
  console.log(`  Added ${newEnemyRows.length} precise StageEnemy rows for stage11-20`);

  // ---------- 2. Replace StageCover rows (including stage20's old wall/crate
  // layout from migrate-v27, which the user also flagged as inaccurate) ----------
  const removedCovers = await deleteRowsWhere("StageCover", (r) => stageIds.includes(r.stageId));
  console.log(`  Removed ${removedCovers} old StageCover rows for stage11-20`);

  const newCoverRows: Record<string, string | number>[] = [];
  for (const [stageId, layout] of Object.entries(LAYOUTS)) {
    for (const [x, y] of layout.crate) newCoverRows.push({ stageId, coverType: "crate", x, y, rotation: 0 });
    for (const [x, y] of layout.bush) newCoverRows.push({ stageId, coverType: "tree", x, y, rotation: 0 });
    for (const [x, y] of layout.house) newCoverRows.push({ stageId, coverType: "house", x, y, rotation: 0 });
    for (const [x, y] of layout.wall) newCoverRows.push({ stageId, coverType: "wall", x, y, rotation: 0 });
  }
  await appendRows("StageCover", newCoverRows);
  console.log(`  Added ${newCoverRows.length} precise StageCover rows for stage11-20`);

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
  console.log(`  Updated playerSpawnX/Y for stage11-20`);

  console.log("\nMigration v31 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
