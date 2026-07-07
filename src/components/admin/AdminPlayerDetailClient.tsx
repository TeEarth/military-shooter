"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PlayerDetail {
  id: string;
  username: string;
  email: string;
  coin: number;
  diamond: number;
  ticket: number;
  vipLevel: number;
  vipExp: number;
  currentStage: number;
  farmStageMaxWave: number;
  isBanned: boolean;
  isTestAccount: boolean;
  createdAt: string;
  lastLogin: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  status: string;
  requestedAt: string;
}

interface Props {
  player: PlayerDetail;
  ownedCharacterIds: string[];
  ownedWeaponIds: string[];
  greenBanknoteBalance: number;
  withdrawals: WithdrawalRequest[];
}

const GIFT_TYPES = [
  { value: "", label: "No gift" },
  { value: "coin", label: "🪙 Coin" },
  { value: "diamond", label: "💎 Diamond" },
  { value: "ticket", label: "🎟️ Ticket" },
  { value: "banknote", label: "💵 Green Banknote" },
];

export default function AdminPlayerDetailClient({ player: initialPlayer, ownedCharacterIds, ownedWeaponIds, greenBanknoteBalance, withdrawals }: Props) {
  const router = useRouter();
  const [player, setPlayer] = useState(initialPlayer);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [giftType, setGiftType] = useState("");
  const [giftAmount, setGiftAmount] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleBan() {
    const next = !player.isBanned;
    setPlayer((p) => ({ ...p, isBanned: next }));
    await fetch("/api/admin/ban", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: player.id, banned: next }),
    });
  }

  /** Permanent — deletes the account and every per-player table row (cascade). */
  async function deleteAccount() {
    if (!confirm(`Permanently delete "${player.username}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      });
      const data = await res.json();
      if (data.success) {
        router.push("/admin");
      } else {
        setStatus(data.error);
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  async function sendMessage() {
    if (loading || !title.trim() || !message.trim()) return;
    setLoading(true);
    setStatus("");
    try {
      const res = await fetch("/api/admin/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerIds: [player.id],
          title,
          message,
          giftType: giftType || undefined,
          giftAmount: giftAmount ? Number(giftAmount) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("Sent.");
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

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin" className="text-military-steel hover:text-white text-sm">← BACK TO ADMIN</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">{player.username}</h1>
        {player.isBanned && <span className="text-red-400 text-xs font-bold">BANNED</span>}
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Profile</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div><span className="text-military-steel">Email</span><p>{player.email}</p></div>
            <div><span className="text-military-steel">Coin</span><p>🪙 {player.coin.toLocaleString()}</p></div>
            <div><span className="text-military-steel">Diamond</span><p>💎 {player.diamond.toLocaleString()}</p></div>
            <div><span className="text-military-steel">Ticket</span><p>🎟️ {player.ticket.toLocaleString()}</p></div>
            <div><span className="text-military-steel">Green Banknote</span><p>💵 {greenBanknoteBalance.toLocaleString()}</p></div>
            <div><span className="text-military-steel">VIP</span><p>VIP {player.vipLevel} ({player.vipExp} exp)</p></div>
            <div><span className="text-military-steel">Stage Reached</span><p>{player.currentStage}</p></div>
            <div><span className="text-military-steel">Farm Max Wave</span><p>{player.farmStageMaxWave}</p></div>
            <div><span className="text-military-steel">Characters Owned</span><p>{ownedCharacterIds.length ? ownedCharacterIds.join(", ") : "—"}</p></div>
            <div><span className="text-military-steel">Weapons Owned</span><p>{ownedWeaponIds.length ? ownedWeaponIds.join(", ") : "—"}</p></div>
            <div><span className="text-military-steel">Joined</span><p>{player.createdAt ? new Date(player.createdAt).toLocaleDateString() : "—"}</p></div>
            <div><span className="text-military-steel">Last Login</span><p>{player.lastLogin ? new Date(player.lastLogin).toLocaleDateString() : "—"}</p></div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={toggleBan} className={`btn-military text-xs ${player.isBanned ? "" : "border-red-400 text-red-400"}`}>
              {player.isBanned ? "Unban Player" : "Ban Player"}
            </button>
            <button onClick={deleteAccount} disabled={deleting} className="btn-military text-xs border-red-600 text-red-600 font-bold">
              {deleting ? "Deleting..." : "Delete Account"}
            </button>
          </div>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Send Message / Gift</h2>
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

        {withdrawals.length > 0 && (
          <div className="card-military">
            <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Withdrawal History</h2>
            <div className="space-y-1">
              {withdrawals.map((w) => (
                <div key={w.id} className="flex justify-between text-xs border-b border-military-dark pb-1">
                  <span>{new Date(w.requestedAt).toLocaleString()}</span>
                  <span>{w.amount} 💵</span>
                  <span className={w.status === "paid" ? "text-green-400" : "text-military-gold"}>{w.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
