"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
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

// Minimal shape of the global Omise.js puts on window — no official types
// shipped for the browser script (only the server SDK has typings).
interface OmiseTokenResult {
  id: string;
}
interface OmiseJs {
  setPublicKey: (key: string) => void;
  createToken: (
    type: "card",
    card: { name: string; number: string; expiration_month: number; expiration_year: number; security_code: string },
    callback: (statusCode: number, response: OmiseTokenResult & { message?: string }) => void
  ) => void;
}
declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

type PayMethod = "card" | "promptpay";
type TopUpPhase = "idle" | "choosing" | "card_form" | "qr_wait" | "processing";

const POLL_INTERVAL_MS = 3000;

export default function IncomeClient({ income: initialIncome, requests: initialRequests, topUpPackages, ticket: initialTicket }: Props) {
  const [income, setIncome] = useState(initialIncome);
  const [requests, setRequests] = useState(initialRequests);
  const [ticket, setTicket] = useState(initialTicket);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [truemoneyPhone, setTruemoneyPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [activePackage, setActivePackage] = useState<TicketTopUpRow | null>(null);
  const [topUpPhase, setTopUpPhase] = useState<TopUpPhase>("idle");
  const [qrImageUrl, setQrImageUrl] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [card, setCard] = useState({ name: "", number: "", expMonth: "", expYear: "", cvc: "" });

  // Stop polling if the player navigates away mid-QR-wait.
  useEffect(() => {
    if (topUpPhase !== "qr_wait" || !transactionId) return;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/payment/omise/status?transactionId=${transactionId}`);
      const data = await res.json();
      if (data.status === "successful") {
        clearInterval(timer);
        sfx.play("pickup_item");
        setTicket((t) => t + (activePackage?.ticketAmount ?? 0));
        setMessage(`+${activePackage?.ticketAmount} tickets — payment confirmed!`);
        closeTopUp();
      } else if (data.status === "failed") {
        clearInterval(timer);
        setMessage("Payment failed or expired.");
        closeTopUp();
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topUpPhase, transactionId]);

  function openTopUp(pkg: TicketTopUpRow) {
    sfx.play("ui_click");
    setActivePackage(pkg);
    setTopUpPhase("choosing");
    setMessage("");
  }

  function closeTopUp() {
    setActivePackage(null);
    setTopUpPhase("idle");
    setQrImageUrl("");
    setTransactionId("");
    setCard({ name: "", number: "", expMonth: "", expYear: "", cvc: "" });
  }

  async function chooseMethod(method: PayMethod) {
    if (!activePackage) return;
    if (method === "card") {
      setTopUpPhase("card_form");
      return;
    }

    setTopUpPhase("processing");
    setMessage("");
    try {
      const res = await fetch("/api/payment/omise/charge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: activePackage.id, method: "promptpay" }),
      });
      const data = await res.json();
      if (data.success && data.qrImageUrl) {
        setQrImageUrl(data.qrImageUrl);
        setTransactionId(data.transactionId);
        setTopUpPhase("qr_wait");
      } else {
        setMessage(data.error ?? "Could not start PromptPay payment");
        setTopUpPhase("choosing");
      }
    } catch {
      setMessage("Network error — payment not started.");
      setTopUpPhase("choosing");
    }
  }

  function submitCard() {
    if (!activePackage || !window.Omise) {
      setMessage("Payment system not ready — try again in a moment.");
      return;
    }
    setTopUpPhase("processing");
    setMessage("");

    window.Omise.createToken(
      "card",
      {
        name: card.name,
        number: card.number.replace(/\s+/g, ""),
        expiration_month: Number(card.expMonth),
        expiration_year: Number(card.expYear),
        security_code: card.cvc,
      },
      async (statusCode, response) => {
        if (statusCode !== 200) {
          setMessage(response.message ?? "Card was declined");
          setTopUpPhase("card_form");
          return;
        }
        try {
          const res = await fetch("/api/payment/omise/charge", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ packageId: activePackage.id, method: "card", cardToken: response.id }),
          });
          const data = await res.json();
          if (data.success && data.status === "successful") {
            sfx.play("pickup_item");
            setTicket((t) => t + activePackage.ticketAmount);
            setMessage(`+${activePackage.ticketAmount} tickets — payment successful!`);
            closeTopUp();
          } else {
            setMessage(data.error ?? "Payment was not successful");
            setTopUpPhase("card_form");
          }
        } catch {
          setMessage("Network error — payment not completed.");
          setTopUpPhase("card_form");
        }
      }
    );
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
      <Script src="https://cdn.omise.co/omise.js" strategy="afterInteractive" onLoad={() => {
        const publicKey = process.env.NEXT_PUBLIC_OMISE_PUBLIC_KEY;
        if (publicKey && window.Omise) window.Omise.setPublicKey(publicKey);
      }} />

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
                onClick={() => openTopUp(p)}
                disabled={loading}
                className="btn-military text-xs py-3 flex flex-col items-center gap-1"
              >
                <span>฿{p.priceBaht}</span>
                <span className="text-military-gold">🎟️ {p.ticketAmount}</span>
              </button>
            ))}
            {topUpPackages.length === 0 && <p className="text-military-steel text-xs col-span-3">No top-up packages configured yet.</p>}
          </div>
          <p className="text-xs text-military-steel mt-3">Paid via Omise — card or PromptPay.</p>
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

      {activePackage && topUpPhase !== "idle" && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => topUpPhase !== "processing" && closeTopUp()}>
          <div className="card-military max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-military-tan uppercase">฿{activePackage.priceBaht} — 🎟️ {activePackage.ticketAmount}</h3>
              {topUpPhase !== "processing" && (
                <button onClick={closeTopUp} className="text-military-steel hover:text-white text-xs">✕</button>
              )}
            </div>

            {topUpPhase === "choosing" && (
              <div className="space-y-2">
                <button onClick={() => chooseMethod("card")} className="btn-military w-full py-3 text-sm">💳 Credit / Debit Card</button>
                <button onClick={() => chooseMethod("promptpay")} className="btn-military w-full py-3 text-sm">📱 PromptPay QR</button>
              </div>
            )}

            {topUpPhase === "card_form" && (
              <div className="space-y-2">
                <input
                  value={card.name}
                  onChange={(e) => setCard((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Name on card"
                  className="w-full bg-military-darker border border-military-steel px-2 py-1 text-sm"
                />
                <input
                  value={card.number}
                  onChange={(e) => setCard((c) => ({ ...c, number: e.target.value }))}
                  placeholder="Card number"
                  inputMode="numeric"
                  className="w-full bg-military-darker border border-military-steel px-2 py-1 text-sm"
                />
                <div className="flex gap-2">
                  <input
                    value={card.expMonth}
                    onChange={(e) => setCard((c) => ({ ...c, expMonth: e.target.value }))}
                    placeholder="MM"
                    inputMode="numeric"
                    className="w-16 bg-military-darker border border-military-steel px-2 py-1 text-sm"
                  />
                  <input
                    value={card.expYear}
                    onChange={(e) => setCard((c) => ({ ...c, expYear: e.target.value }))}
                    placeholder="YYYY"
                    inputMode="numeric"
                    className="w-20 bg-military-darker border border-military-steel px-2 py-1 text-sm"
                  />
                  <input
                    value={card.cvc}
                    onChange={(e) => setCard((c) => ({ ...c, cvc: e.target.value }))}
                    placeholder="CVC"
                    inputMode="numeric"
                    className="flex-1 bg-military-darker border border-military-steel px-2 py-1 text-sm"
                  />
                </div>
                <button
                  onClick={submitCard}
                  disabled={!card.name || !card.number || !card.expMonth || !card.expYear || !card.cvc}
                  className="btn-gold w-full py-2 text-sm mt-2"
                >
                  Pay ฿{activePackage.priceBaht}
                </button>
              </div>
            )}

            {topUpPhase === "qr_wait" && qrImageUrl && (
              <div className="text-center space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImageUrl} alt="PromptPay QR" className="w-56 h-56 mx-auto bg-white p-2" />
                <p className="text-xs text-military-steel">Scan with your banking app to pay ฿{activePackage.priceBaht}</p>
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-military-steel border-t-military-tan rounded-full animate-spin" />
                  <span className="text-xs text-military-tan">Waiting for payment...</span>
                </div>
              </div>
            )}

            {topUpPhase === "processing" && (
              <div className="text-center py-6">
                <div className="w-8 h-8 mx-auto border-2 border-military-steel border-t-military-tan rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
