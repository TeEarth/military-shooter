"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlayerIncomeRow, WithdrawalRequestRow } from "@/lib/db/income";
import type { TicketTopUpRow } from "@/lib/google/topup";
import { sfx } from "@/lib/sfx";

interface Props {
  income: PlayerIncomeRow;
  requests: WithdrawalRequestRow[];
  topUpPackages: TicketTopUpRow[];
  ticket: number;
}

export default function IncomeClient({ income: initialIncome, requests: initialRequests, topUpPackages, ticket: initialTicket }: Props) {
  const [income, setIncome] = useState(initialIncome);
  const [requests, setRequests] = useState(initialRequests);
  const [ticket, setTicket] = useState(initialTicket);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [truemoneyPhone, setTruemoneyPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function topUp(packageId: string) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/income/topup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (data.success) {
        sfx.play("pickup_item");
        setTicket(data.player.ticket);
        setMessage(data.message);
      } else {
        setMessage(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function withdraw() {
    const amount = Number(withdrawAmount);
    if (loading || !amount || amount <= 0 || !truemoneyPhone.trim()) return;
    sfx.play("ui_click");
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/income/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, phone: truemoneyPhone.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIncome((prev) => ({ ...prev, greenBanknoteBalance: prev.greenBanknoteBalance - amount }));
        setRequests((prev) => [data.request, ...prev]);
        setWithdrawAmount("");
        setMessage(data.message);
      } else {
        setMessage(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Income</h1>
        <div className="ml-auto text-sm">🎟️ {ticket}</div>
      </div>

      {message && <div className="max-w-2xl mx-auto mb-4 text-military-gold text-sm">{message}</div>}

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">Top Up Tickets</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {topUpPackages.map((p) => (
              <button
                key={p.id}
                onClick={() => topUp(p.id)}
                disabled={loading}
                className="btn-military text-xs py-3 flex flex-col items-center gap-1"
              >
                <span>฿{p.priceBaht}</span>
                <span className="text-military-gold">🎟️ {p.ticketAmount}</span>
              </button>
            ))}
            {topUpPackages.length === 0 && <p className="text-military-steel text-xs col-span-3">No top-up packages configured yet.</p>}
          </div>
          <p className="text-xs text-military-steel mt-3">Mock payment — grants tickets immediately for testing. Swap for a real payment gateway before launch.</p>
        </div>

        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-2 uppercase tracking-wider">Green Banknotes</h2>
          <p className="text-xs text-military-steel mb-3">
            Earned from boss kills and every 5 personal stage-milestones. 1 banknote = ฿1, paid out via TrueMoney Wallet.
            Withdrawals are reviewed and paid out manually by an admin — this is not an automatic cash-out.
            Limited to 100 baht per day.
          </p>
          <p className="text-sm mb-1">Balance: <span className="text-green-400 font-bold">{income.greenBanknoteBalance} 💵</span></p>
          <p className="text-sm mb-3">Total withdrawn: <span className="text-white">{income.totalWithdrawn} 💵</span></p>

          <div className="flex flex-col gap-2 mb-3 max-w-xs">
            <input
              type="tel"
              value={truemoneyPhone}
              onChange={(e) => setTruemoneyPhone(e.target.value)}
              placeholder="TrueMoney phone number"
              className="bg-military-darker border border-military-steel px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={Math.min(100, income.greenBanknoteBalance)}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Amount (max 100/day)"
                className="bg-military-darker border border-military-steel px-2 py-1 text-sm flex-1"
              />
              <button onClick={withdraw} disabled={loading || income.greenBanknoteBalance <= 0 || !truemoneyPhone.trim()} className="btn-gold text-xs px-4">
                Request Withdrawal
              </button>
            </div>
          </div>

          {requests.length > 0 && (
            <div className="space-y-1">
              <h3 className="text-xs text-military-steel uppercase tracking-wider">Request history</h3>
              {requests.map((r) => (
                <div key={r.id} className="flex justify-between text-xs">
                  <span>{new Date(r.requestedAt).toLocaleDateString()}</span>
                  <span>{r.amount} 💵 → {r.phone}</span>
                  <span className={r.status === "processed" ? "text-green-400" : "text-military-gold"}>{r.status.toUpperCase()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
