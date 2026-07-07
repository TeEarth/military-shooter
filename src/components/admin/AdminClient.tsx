"use client";

import { useState } from "react";
import Link from "next/link";

interface PlayerSummary {
  id: string;
  username: string;
  email: string;
  coin: number;
  diamond: number;
  ticket: number;
  vipLevel: number;
  currentStage: number;
  farmStageMaxWave: number;
  isBanned: boolean;
}

interface Props {
  players: PlayerSummary[];
}

const GIFT_TYPES = [
  { value: "", label: "No gift" },
  { value: "coin", label: "🪙 Coin" },
  { value: "diamond", label: "💎 Diamond" },
  { value: "ticket", label: "🎟️ Ticket" },
  { value: "banknote", label: "💵 Green Banknote" },
];

export default function AdminClient({ players: initialPlayers }: Props) {
  const [players, setPlayers] = useState(initialPlayers);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [giftType, setGiftType] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleSelected(id: string) {
    setSelectAll(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendMessage() {
    if (loading) return;
    if (!selectAll && selected.size === 0) {
      setStatus("Select at least one player, or check Select All.");
      return;
    }
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: selectAll ? "all" : Array.from(selected),
          title,
          message,
          giftType: giftType || undefined,
          giftAmount: giftAmount ? Number(giftAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`Sent to ${data.sentTo} player(s).`);
        setTitle("");
        setMessage("");
        setGiftType("");
        setGiftAmount("");
      } else {
        setStatus(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleBan(playerId: string, banned: boolean) {
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isBanned: banned } : p)));
    await fetch("/api/admin/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, banned }),
    });
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Admin</h1>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Message / Gift Players</h2>
          <div className="flex items-center gap-2 mb-3">
            <input type="checkbox" checked={selectAll} onChange={(e) => { setSelectAll(e.target.checked); setSelected(new Set()); }} />
            <span className="text-sm">Select All ({players.length} players)</span>
            {!selectAll && <span className="text-xs text-military-steel">({selected.size} selected)</span>}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full bg-military-darker border border-military-steel px-2 py-1 text-sm mb-2"
          />
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Message"
            rows={3}
            className="w-full bg-military-darker border border-military-steel px-2 py-1 text-sm mb-2"
          />
          <div className="flex gap-2 mb-3">
            <select value={giftType} onChange={(e) => setGiftType(e.target.value)} className="bg-military-darker border border-military-steel px-2 py-1 text-sm">
              {GIFT_TYPES.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            {giftType && (
              <input
                type="number"
                min={1}
                value={giftAmount}
                onChange={(e) => setGiftAmount(e.target.value)}
                placeholder="Amount"
                className="bg-military-darker border border-military-steel px-2 py-1 text-sm w-32"
              />
            )}
          </div>
          {status && <p className="text-military-gold text-xs mb-2">{status}</p>}
          <button onClick={sendMessage} disabled={loading || !title.trim() || !message.trim()} className="btn-gold text-xs px-4">
            {loading ? "Sending..." : "Send"}
          </button>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Players ({players.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-military-steel text-left border-b border-military-steel">
                  <th className="p-1"></th>
                  <th className="p-1">Username</th>
                  <th className="p-1">Email</th>
                  <th className="p-1">🪙</th>
                  <th className="p-1">💎</th>
                  <th className="p-1">🎟️</th>
                  <th className="p-1">VIP</th>
                  <th className="p-1">Stage</th>
                  <th className="p-1">Farm Wave</th>
                  <th className="p-1"></th>
                  <th className="p-1"></th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} className={`border-b border-military-dark ${p.isBanned ? "opacity-50" : ""}`}>
                    <td className="p-1">
                      <input type="checkbox" checked={selectAll || selected.has(p.id)} disabled={selectAll} onChange={() => toggleSelected(p.id)} />
                    </td>
                    <td className="p-1 font-bold">{p.username}</td>
                    <td className="p-1 text-military-steel">{p.email}</td>
                    <td className="p-1">{p.coin.toLocaleString()}</td>
                    <td className="p-1">{p.diamond.toLocaleString()}</td>
                    <td className="p-1">{p.ticket.toLocaleString()}</td>
                    <td className="p-1">{p.vipLevel}</td>
                    <td className="p-1">{p.currentStage}</td>
                    <td className="p-1">{p.farmStageMaxWave}</td>
                    <td className="p-1">
                      <Link href={`/admin/players/${p.id}`} className="text-blue-400 hover:underline">View</Link>
                    </td>
                    <td className="p-1">
                      <button onClick={() => toggleBan(p.id, !p.isBanned)} className={p.isBanned ? "text-green-400" : "text-red-400"}>
                        {p.isBanned ? "Unban" : "Ban"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
