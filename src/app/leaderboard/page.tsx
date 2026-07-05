import { getAllPlayers } from "@/lib/google/player";
import Link from "next/link";

export default async function LeaderboardPage() {
  const players = await getAllPlayers();

  const ranked = players
    .filter((p) => !p.isBanned)
    .map((p) => ({ username: p.username, level: p.level, exp: p.exp, score: p.level * 100000 + p.exp }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Leaderboard</h1>
      </div>

      <div className="max-w-2xl mx-auto">
        {ranked.length === 0 && (
          <div className="text-center text-military-steel py-12">No entries yet. Be the first!</div>
        )}
        {ranked.map((entry, i) => (
          <div key={`${entry.username}-${i}`} className={`flex items-center gap-4 p-4 border-b border-military-steel ${i < 3 ? "bg-military-dark" : ""}`}>
            <span className={`text-lg font-black w-8 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-military-steel"}`}>
              {i + 1}
            </span>
            <div className="flex-1">
              <p className="font-bold">{entry.username}</p>
              <p className="text-xs text-military-steel">LVL {entry.level}</p>
            </div>
            <span className="text-military-gold font-bold">{entry.score.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
