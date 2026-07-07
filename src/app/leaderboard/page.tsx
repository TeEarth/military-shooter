import { getLeaderboard } from "@/lib/db/leaderboard";
import Link from "next/link";

const REWARD_LABEL = ["+20 💵", "+10 💵", "+5 💵"];
const RANK_MEDAL = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const { entries, weekStart } = await getLeaderboard();

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">🏆 Leaderboard</h1>
      </div>
      <p className="text-xs text-military-steel mb-6 max-w-2xl mx-auto text-center">
        Ranked by highest Farm Stage wave reached this week (since {weekStart}). Ties are broken by coin balance.
        Resets every week — top 3 get green banknotes (1st +20, 2nd +10, 3rd +5) mailed to their inbox.
      </p>

      <div className="max-w-2xl mx-auto rounded-lg overflow-hidden border border-military-steel/60 shadow-lg shadow-black/30">
        {entries.length === 0 && (
          <div className="text-center text-military-steel py-12 bg-military-dark/40">No entries yet this week. Be the first!</div>
        )}
        {entries.map((entry, i) => {
          const isTop3 = i < 3;
          return (
            <div
              key={`${entry.username}-${i}`}
              className={`flex items-center gap-4 px-4 py-3 border-b border-military-steel/30 last:border-b-0 transition-colors ${
                isTop3
                  ? i === 0
                    ? "bg-gradient-to-r from-yellow-900/40 via-military-dark to-military-dark"
                    : i === 1
                      ? "bg-gradient-to-r from-slate-500/20 via-military-dark to-military-dark"
                      : "bg-gradient-to-r from-amber-800/25 via-military-dark to-military-dark"
                  : "bg-military-darker/40 hover:bg-military-dark/60"
              }`}
            >
              <span
                className={`text-lg font-black w-9 text-center ${
                  i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-500" : "text-military-steel"
                }`}
              >
                {isTop3 ? RANK_MEDAL[i] : `#${i + 1}`}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{entry.username}</p>
                <p className="text-xs text-military-steel">
                  Wave <span className="text-military-tan font-semibold">{entry.wave}</span>
                  <span className="mx-1.5 text-military-steel/50">•</span>
                  🪙 {entry.coin.toLocaleString()}
                </p>
              </div>
              {isTop3 && <span className="text-emerald-400 font-bold text-sm whitespace-nowrap">{REWARD_LABEL[i]}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
