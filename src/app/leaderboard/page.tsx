import { getLeaderboard } from "@/lib/db/leaderboard";
import Link from "next/link";

const REWARD_LABEL = ["+20 💵", "+10 💵", "+5 💵"];

export default async function LeaderboardPage() {
  const { entries, weekStart } = await getLeaderboard();

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Leaderboard</h1>
      </div>
      <p className="text-xs text-military-steel mb-6 max-w-2xl mx-auto">
        Ranked by highest Farm Stage wave reached this week (since {weekStart}). Resets every week —
        top 3 get green banknotes (1st +20, 2nd +10, 3rd +5) mailed to their inbox.
      </p>

      <div className="max-w-2xl mx-auto">
        {entries.length === 0 && (
          <div className="text-center text-military-steel py-12">No entries yet this week. Be the first!</div>
        )}
        {entries.map((entry, i) => (
          <div key={`${entry.username}-${i}`} className={`flex items-center gap-4 p-4 border-b border-military-steel ${i < 3 ? "bg-military-dark" : ""}`}>
            <span className={`text-lg font-black w-8 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-military-steel"}`}>
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-bold">{entry.username}</p>
              <p className="text-xs text-military-steel">Wave {entry.wave}</p>
            </div>
            {i < 3 && <span className="text-emerald-400 font-bold text-sm">{REWARD_LABEL[i]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
