/**
 * Repeatable test-account reset — run this before every test pass, as many
 * times as you like (NOT a one-off migration).
 *
 * v12: rewritten for the Supabase migration — player data (Players and every
 * per-player table) now lives in Supabase, not Google Sheets, so this script
 * deletes rows there directly instead of via deleteRowsWhere(). No cache to
 * invalidate anymore (db/*.ts hits Postgres directly, no local cache layer),
 * which removes the whole stale-cache dance the old Sheets version needed.
 *
 * v9 #4: before creating the new account, this still deletes EVERY row
 * flagged `isTestAccount = true` in Players (not just the one account you
 * named) — plus the named email's row even if it predates the flag — along
 * with all their related rows across every per-player table. Real player
 * accounts are never touched: the flag is only ever set by this script.
 *
 * The new account is created fresh with unlimited currency (v6/v7 rules
 * still apply: no auto-granted characters/weapons beyond the normal
 * Bob+Pistol starter), and the password is ALWAYS reset to a known value
 * (v7 #1) and printed clearly every run.
 *
 * Usage: npx tsx scripts/reset-test-account.ts --email=someone@example.com [--password=Something123!]
 *    or: npm run test:reset -- --email=someone@example.com
 */
import "dotenv/config";
import { getAllPlayers, getPlayerByEmail, createPlayer, updatePlayer } from "../src/lib/db/player";
import { getSupabaseClient } from "../src/lib/supabase/client";
import { deleteRowsWhere } from "../src/lib/google/sheet";

const UNLIMITED = 999_999_999;
const DEFAULT_PASSWORD = "Test1234!";

// Every Supabase table that stores per-player rows keyed by player_id — wiped
// for each deleted test account alongside its Players row itself.
const PER_PLAYER_TABLES = [
  "player_weapon", "player_equipment", "player_equipment_level", "player_character",
  "player_weapon_ammo", "player_passive", "player_stage_progress", "player_mission",
  "player_income", "player_boss_progress",
];

// WithdrawalRequest was never migrated to Supabase (admin-processed, stays
// editable via Google Sheets) — still needs the old Sheets-based wipe.
const WITHDRAWAL_REQUEST_SHEET = "WithdrawalRequest";

function parseArg(prefix: string): string | undefined {
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function parseEmail(): string {
  const email = parseArg("--email=") || process.env.TEST_RESET_EMAIL;
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-test-account.ts --email=someone@example.com [--password=Something123!]");
    process.exit(1);
  }
  return email;
}

async function main() {
  const email = parseEmail();
  const passwordArg = parseArg("--password=");
  const password = passwordArg ?? DEFAULT_PASSWORD;
  const supabase = getSupabaseClient();

  // 1. Find every account to wipe: everything already flagged isTestAccount,
  //    plus the specifically-named email (even if it predates the flag).
  const allPlayers = await getAllPlayers();
  const flaggedTestAccounts = allPlayers.filter((p) => p.isTestAccount);
  const namedAccount = await getPlayerByEmail(email);

  const wipeIds = new Set(flaggedTestAccounts.map((p) => p.id));
  if (namedAccount) wipeIds.add(namedAccount.id);

  if (wipeIds.size === 0) {
    console.log("No previous test accounts found to wipe.");
  } else {
    const ids = [...wipeIds];
    console.log(`Wiping ${ids.length} old test account(s): ${ids.join(", ")}`);

    for (const table of PER_PLAYER_TABLES) {
      const { error, count } = await supabase.from(table).delete({ count: "exact" }).in("player_id", ids);
      if (error) throw new Error(`Failed clearing ${table}: ${error.message}`);
      if (count) console.log(`  Cleared ${count} row(s) from ${table}`);
    }

    const removed = await deleteRowsWhere(WITHDRAWAL_REQUEST_SHEET, (r) => wipeIds.has(r.playerId));
    if (removed > 0) console.log(`  Cleared ${removed} row(s) from ${WITHDRAWAL_REQUEST_SHEET} (Sheets)`);

    const { error: playersError, count: playersCount } = await supabase.from("players").delete({ count: "exact" }).in("id", ids);
    if (playersError) throw new Error(`Failed clearing players: ${playersError.message}`);
    console.log(`  Deleted ${playersCount ?? 0} row(s) from players`);
  }

  // 2. Create a brand new account — same path as /api/auth/register, flagged
  //    as a test account so future runs of this script can find + wipe it too.
  //    createPlayer() already grants+equips Pistol (v7 #4); nothing else is
  //    auto-granted (v6 #9 / v7 #4 rule still applies).
  const player = await createPlayer({ email, username: email.split("@")[0], password, isTestAccount: true });
  console.log(`Created fresh test account: ${player.id}`);

  // 3. v12: coin/diamond stay at their normal createPlayer() default (0, per
  //    config/economy.ts — "everything starts at zero") so the account plays
  //    like a real new player. Only ticket is unlimited, for testing
  //    ticket-gated features (gacha, top-up flows) without running dry.
  await updatePlayer(player.id, { ticket: UNLIMITED });

  console.log("\n✅ Test account ready");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Player ID: ${player.id}`);
  console.log(`Currency: 0 coin, 0 diamond, ${UNLIMITED.toLocaleString()} ticket (unlimited)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
