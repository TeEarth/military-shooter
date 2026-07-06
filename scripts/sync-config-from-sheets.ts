/**
 * v13: syncs every config Google Sheet into the `game_config` Supabase table
 * (see scripts/sql/002_config_schema.sql), so the app can read fast Postgres
 * queries instead of slow live Sheets calls for game-balance data. Run this
 * manually any time you edit a config sheet — it is NOT auto-synced per
 * request (per the original plan: Sheets stays the editable source of truth,
 * Supabase is just a fast read-through cache of it).
 *
 * Usage: npx tsx scripts/sync-config-from-sheets.ts
 */
import "dotenv/config";
import { readSheetRaw } from "../src/lib/google/sheet";
import { getSupabaseClient } from "../src/lib/supabase/client";

const CONFIG_SHEETS = [
  "Characters", "Weapons", "Equipment", "Enemies", "Stage", "StageEnemy", "StageCover",
  "PassiveConfig", "GachaConfig", "CurrencyExchangeConfig", "TicketTopUp", "VipConfig",
  "BossStage", "Mission",
];

async function main() {
  const supabase = getSupabaseClient();

  for (const sheetName of CONFIG_SHEETS) {
    const { rows } = await readSheetRaw(sheetName);

    const { error: deleteError } = await supabase.from("game_config").delete().eq("sheet_name", sheetName);
    if (deleteError) throw new Error(`Failed clearing ${sheetName}: ${deleteError.message}`);

    if (rows.length === 0) {
      console.log(`  ${sheetName}: 0 rows (sheet empty, skipping insert)`);
      continue;
    }

    const payload = rows.map((row, index) => ({ sheet_name: sheetName, row_index: index, row_data: row }));
    const { error: insertError } = await supabase.from("game_config").insert(payload);
    if (insertError) throw new Error(`Failed syncing ${sheetName}: ${insertError.message}`);

    console.log(`  ${sheetName}: synced ${rows.length} row(s)`);
  }

  console.log("\nConfig sync complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
