"use client";

import { useState } from "react";
import Link from "next/link";

interface MailItem {
  id: string;
  playerId: string;
  title: string;
  message: string;
  reward: string;
  claimed: boolean;
  sentAt: string;
}

function formatSentAt(sentAt: string): string {
  if (!sentAt) return "";
  const d = new Date(sentAt);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ICON_FOR_TYPE: Record<string, string> = { coin: "🪙", diamond: "💎", ticket: "🎟️", exp: "⭐", equipment: "🔧", character: "🪖", withdrawal: "💸" };

export default function MailboxClient({ items }: { items: MailItem[] }) {
  const [mail, setMail] = useState(items);
  const [loading, setLoading] = useState(false);

  async function handleAction(id: string, action: "claim" | "approve_withdrawal") {
    setLoading(true);
    const res = await fetch("/api/mailbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ index: id, action }),
    });
    const data = await res.json();
    if (data.success) setMail((prev) => prev.map((m) => m.id === id ? { ...m, claimed: true } : m));
    setLoading(false);
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Mailbox</h1>
      </div>

      <div className="max-w-2xl mx-auto space-y-3">
        {mail.length === 0 && <div className="text-center text-military-steel py-12">No messages</div>}
        {mail.map((item) => {
          const [type, value] = item.reward.split(":");
          const isWithdrawal = type === "withdrawal";
          return (
            <div key={item.id} className={`card-military flex items-start gap-4 ${!item.claimed ? "border-military-tan" : ""}`}>
              <span className="text-3xl">{ICON_FOR_TYPE[type] ?? "📦"}</span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-bold">{item.title}</h3>
                  {formatSentAt(item.sentAt) && <span className="text-military-steel text-[11px] whitespace-nowrap">{formatSentAt(item.sentAt)}</span>}
                </div>
                <p className="text-military-steel text-sm">{item.message}</p>
                {!isWithdrawal && value && <p className="text-military-gold text-sm mt-1">+{value} {type}</p>}
              </div>
              {!item.claimed && isWithdrawal && (
                <button onClick={() => handleAction(item.id, "approve_withdrawal")} disabled={loading} className="btn-military text-xs whitespace-nowrap">✓ MARK PAID</button>
              )}
              {!item.claimed && !isWithdrawal && (
                <button onClick={() => handleAction(item.id, "claim")} disabled={loading} className="btn-military text-xs">CLAIM</button>
              )}
              {item.claimed && <span className="text-green-400 text-xs">{isWithdrawal ? "PAID" : "CLAIMED"}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
