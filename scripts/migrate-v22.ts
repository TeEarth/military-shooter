/**
 * v22: adds a "sentAt" column to the Mail sheet (ISO timestamp), backfilling
 * every existing row with "now" so none of them get mistaken for expired —
 * see MAIL_EXPIRY_MS/purgeExpiredMail() in src/lib/google/reward.ts, which
 * only auto-deletes CLAIMED mail older than 7 days (never unclaimed rewards).
 *
 * Run with: npx tsx scripts/migrate-v22.ts
 */
import "dotenv/config";
import { getSheetsClient, getSpreadsheetId } from "../src/lib/google/google";
import { getHeaders, readSheetRaw, updateRow } from "../src/lib/google/sheet";

async function ensureColumn(sheetName: string, columnName: string) {
  const headers = await getHeaders(sheetName);
  if (headers.includes(columnName)) return false;

  const sheets = getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const colLetter = String.fromCharCode(65 + headers.length);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colLetter}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[columnName]] },
  });
  console.log(`  Added column "${columnName}" to ${sheetName} at ${colLetter}1`);
  return true;
}

async function main() {
  await ensureColumn("Mail", "sentAt");

  const { rows } = await readSheetRaw("Mail");
  const now = new Date().toISOString();
  let backfilled = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].sentAt) continue;
    await updateRow("Mail", i, { sentAt: now });
    backfilled++;
  }
  console.log(`  Backfilled sentAt on ${backfilled} existing row(s)`);
  console.log("\nMigration v22 complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
