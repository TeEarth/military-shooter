/**
 * Repeatable test-account reset — run this before every test pass, as many
 * times as you like (NOT a one-off migration).
 *
 * v9 #4: before creating the new account, this now deletes EVERY row flagged
 * `isTestAccount = true` in Players (not just the one account you named) —
 * plus the named email's row even if it predates the flag — along with all
 * their related rows across every per-player sheet. Real player accounts are
 * never touched: the flag is only ever set by this script (see
 * createPlayer()'s isTestAccount param), so nothing without it gets deleted.
 *
 * The new account is created fresh with unlimited currency (v6/v7 rules still
 * apply: no auto-granted characters/weapons beyond the normal Bob+Pistol
 * starter every player gets), and the password is ALWAYS reset to a known
 * value (v7 #1) and printed clearly every run.
 *
 * Usage: npx tsx scripts/reset-test-account.ts --email=someone@example.com [--password=Something123!]
 *    or: npm run test:reset -- --email=someone@example.com
 */
import "dotenv/config";
import { getAllPlayers, getPlayerByEmail, createPlayer, updatePlayer } from "../src/lib/google/player";
import { deleteRowsWhere } from "../src/lib/google/sheet";
import { invalidateSheetCache } from "../src/lib/google/cache";

const UNLIMITED = 999_999_999;
const DEFAULT_PASSWORD = "Test1234!";

// Every sheet that stores per-player rows keyed by playerId — wiped for each
// deleted test account alongside its Players row itself.
const PER_PLAYER_SHEETS = [
  "PlayerWeapon", "PlayerEquipment", "PlayerCharacter", "PlayerStageProgress",
  "PlayerWeaponAmmo", "PlayerPassive", "PlayerMission", "PlayerIncome",
  "PlayerBossProgress", "PlayerEquipmentLevel", "WithdrawalRequest",
];

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
    console.log(`Wiping ${wipeIds.size} old test account(s): ${[...wipeIds].join(", ")}`);

    for (const sheetName of PER_PLAYER_SHEETS) {
      const removed = await deleteRowsWhere(sheetName, (r) => wipeIds.has(r.playerId));
      if (removed > 0) console.log(`  Cleared ${removed} row(s) from ${sheetName}`);
    }

    const removedPlayers = await deleteRowsWhere("Players", (r) => wipeIds.has(r.id));
    console.log(`  Deleted ${removedPlayers} row(s) from Players`);

    // deleteRowsWhere() writes straight to the Sheets API and knows nothing
    // about cache.ts's in-process cache — without this, createPlayer() below
    // calls getPlayerByEmail(), which reads the now-stale cached Players rows
    // (still containing the just-deleted account) and throws "Email already
    // in use" even though the row is already gone on the live sheet.
    invalidateSheetCache("Players");
  }

  // 2. Create a brand new account — same path as /api/auth/register, flagged
  //    as a test account so future runs of this script can find + wipe it too.
  //    createPlayer() already grants+equips Pistol (v7 #4); nothing else is
  //    auto-granted (v6 #9 / v7 #4 rule still applies).
  const player = await createPlayer({ email, username: email.split("@")[0], password, isTestAccount: true });
  console.log(`Created fresh test account: ${player.id}`);

  // 3. Unlimited currency for testing purchases/gacha/exchange without running dry.
  await updatePlayer(player.id, {
    coin: UNLIMITED,
    diamond: UNLIMITED,
    ticket: UNLIMITED,
  });

  invalidateSheetCache("Players"); // clears THIS script process's own cache — see the note below

  // v8 #2: this script runs as its OWN Node process, separate from the running
  // Next.js server — invalidateSheetCache() above only clears this process's
  // local cache map (which disappears when the script exits anyway). It can
  // NEVER reach into the live server's in-memory cache. Tell the real running
  // server to drop its cache via HTTP instead — if the server isn't running,
  // this just logs a warning (the sheet data is still correct; the app will
  // pick it up once its cache TTL naturally expires or it's restarted).
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    const res = await fetch(`${baseUrl}/api/internal/invalidate-cache`, {
      method: "POST",
      headers: { "x-internal-secret": process.env.NEXTAUTH_SECRET ?? "" },
    });
    if (res.ok) {
      console.log(`  Live server cache invalidated (${baseUrl})`);
    } else {
      console.warn(`  Could not invalidate live server cache (HTTP ${res.status}) — it'll pick up the reset once its cache TTL expires.`);
    }
  } catch {
    console.warn(`  Could not reach ${baseUrl} to invalidate its cache (server not running?) — it'll pick up the reset once its cache TTL expires or on restart.`);
  }

  console.log("\n✅ Test account ready");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Player ID: ${player.id}`);
  console.log(`Currency: ${UNLIMITED.toLocaleString()} coin/diamond/ticket`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
