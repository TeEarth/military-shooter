/**
 * Live-spreadsheet migration for v11 #2: replaces stage01-10's placeholder
 * StageEnemy rows and random cover scatter with real positions traced from
 * the user's stage-layout PDF ("แผนผัง Stage 1-10 , Stage Farm.pdf"), via
 * scripts/extract-stage-pdf.py -> scripts/data/stage-layout-raw.json.
 *
 * - Adds playerSpawnX/playerSpawnY to Stage (0 = "not designed", GameScene
 *   keeps its old hardcoded default for any stage without real data).
 * - Creates + seeds a new StageCover sheet (stageId, coverType, x, y) —
 *   GameScene.createCovers() uses these when present, random otherwise.
 * - Replaces StageEnemy rows for stage01-10 with the real enemy positions
 *   (weapon-number legend: 1=Pistol, 2=AK47, 3=Shotgun, 4=Sniper, 5=Rocket).
 * - Farm (farm_01) gets a playerSpawn + StageCover base map ONLY — no
 *   StageEnemy rows, since farm enemies are drawn dynamically per wave by
 *   GameScene's existing spawnWave()/randomSpawnPoint() logic (unchanged,
 *   per the PDF's own "Stage Farm" description page).
 *
 * Run with: npx tsx scripts/migrate-v14.ts
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { ensureSheetExists, readSheetRaw, appendRows, updateRow } from "../src/lib/google/sheet";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";

const PDF_PAGE_WIDTH = 792;
const PDF_PAGE_HEIGHT = 612;
const EDGE_MARGIN = 60;

const WEAPON_NUM_TO_ENEMY_ID: Record<number, string> = {
  1: "enemy_pistol",
  2: "enemy_ak47",
  3: "enemy_shotgun",
  4: "enemy_sniper",
  5: "enemy_rocket",
};

// Extracted stage ids map 1:1 onto the game's actual stage ids except the
// farm stage, whose extraction key is "farm" but whose real Stage row id is "farm_01".
const STAGE_ID_MAP: Record<string, string> = {
  stage01: "stage01", stage02: "stage02", stage03: "stage03", stage04: "stage04", stage05: "stage05",
  stage06: "stage06", stage07: "stage07", stage08: "stage08", stage09: "stage09", stage10: "stage10",
  farm: "farm_01",
};

interface RawPoint { cx: number; cy: number }
interface RawEnemy extends RawPoint { weaponNum: number | null }
interface RawCover extends RawPoint { type: string; w: number; h: number }
interface RawStage {
  page_rect: [number, number];
  player_start: RawPoint | null;
  enemies: RawEnemy[];
  covers: RawCover[];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Linearly maps a PDF-space coordinate onto a stage's actual world size,
 *  clamped away from the very edge so nothing spawns half-off-world. */
function toGameCoord(pdfX: number, pdfY: number, stageWidth: number, stageHeight: number) {
  const gx = (pdfX / PDF_PAGE_WIDTH) * stageWidth;
  const gy = (pdfY / PDF_PAGE_HEIGHT) * stageHeight;
  return {
    x: Math.round(clamp(gx, EDGE_MARGIN, stageWidth - EDGE_MARGIN)),
    y: Math.round(clamp(gy, EDGE_MARGIN, stageHeight - EDGE_MARGIN)),
  };
}

async function clearDataRows(sheetName: string) {
  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A2:ZZ10000` });
}

async function main() {
  const rawPath = path.join(__dirname, "data", "stage-layout-raw.json");
  const raw: Record<string, RawStage> = JSON.parse(fs.readFileSync(rawPath, "utf-8"));

  console.log("Appending playerSpawnX/playerSpawnY to Stage header...");
  await ensureSheetExists("Stage", [
    "id", "name", "isRepeatable", "width", "height", "background", "rewardCoin", "rewardExp",
    "playerSpawnX", "playerSpawnY",
  ]);

  console.log("Creating StageCover sheet...");
  await ensureSheetExists("StageCover", ["stageId", "coverType", "x", "y"]);

  // Need each stage's actual width/height (already configured, e.g. stage04 = 1600x900)
  // to scale PDF-space positions correctly per stage.
  const { rows: stageRows } = await readSheetRaw("Stage");
  const stageDims = new Map<string, { width: number; height: number; rowIndex: number }>();
  stageRows.forEach((r, idx) => {
    stageDims.set(r.id, { width: Number(r.width || 1280), height: Number(r.height || 720), rowIndex: idx });
  });

  const newCoverRows: Record<string, string | number>[] = [];
  const stageEnemyReplacements = new Map<string, Record<string, string | number>[]>();

  for (const [extractId, gameStageId] of Object.entries(STAGE_ID_MAP)) {
    const data = raw[extractId];
    const dims = stageDims.get(gameStageId);
    if (!data || !dims) {
      console.warn(`  Skipping ${gameStageId} — no PDF data or Stage row found`);
      continue;
    }

    // 1. Player spawn point.
    if (data.player_start) {
      const { x, y } = toGameCoord(data.player_start.cx, data.player_start.cy, dims.width, dims.height);
      await updateRow("Stage", dims.rowIndex, { playerSpawnX: x, playerSpawnY: y });
    }

    // 2. Cover objects.
    for (const cover of data.covers) {
      const { x, y } = toGameCoord(cover.cx, cover.cy, dims.width, dims.height);
      newCoverRows.push({ stageId: gameStageId, coverType: cover.type, x, y });
    }

    // 3. Enemy spawns — story stages only, never the farm (dynamic wave spawns).
    if (gameStageId !== "farm_01") {
      const rows = data.enemies
        .filter((e) => e.weaponNum !== null && WEAPON_NUM_TO_ENEMY_ID[e.weaponNum])
        .map((e) => {
          const { x, y } = toGameCoord(e.cx, e.cy, dims.width, dims.height);
          return { stageId: gameStageId, enemyId: WEAPON_NUM_TO_ENEMY_ID[e.weaponNum as number], spawnX: x, spawnY: y };
        });
      stageEnemyReplacements.set(gameStageId, rows);
    }

    console.log(`  ${gameStageId}: spawn=${JSON.stringify(data.player_start)}, ${data.covers.length} covers, ${data.enemies.length} enemies`);
  }

  console.log(`\nSeeding ${newCoverRows.length} StageCover row(s)...`);
  await appendRows("StageCover", newCoverRows);

  console.log("Replacing StageEnemy rows for stage01-10 with real positions...");
  const { rows: existingStageEnemyRows } = await readSheetRaw("StageEnemy");
  const designedStageIds = new Set(stageEnemyReplacements.keys());
  const kept = existingStageEnemyRows.filter((r) => !designedStageIds.has(r.stageId));
  const replaced = Array.from(stageEnemyReplacements.values()).flat();
  await clearDataRows("StageEnemy");
  await appendRows("StageEnemy", [...kept, ...replaced]);
  console.log(`  Kept ${kept.length} row(s) for undesigned stages, added ${replaced.length} real row(s)`);

  console.log("\nMigration v14 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
