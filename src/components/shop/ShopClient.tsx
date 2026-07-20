"use client";

import { useState } from "react";
import Link from "next/link";
import type { CurrencyExchangeRow } from "@/lib/google/exchange";
import { sfx } from "@/lib/sfx";
import { showRewardedAd } from "@/lib/ads-service";
import CurrencyBar from "@/components/ui/CurrencyBar";
import Icon, { type IconName } from "@/components/ui/Icon";

const CURRENCY_ICON_NAME: Record<string, IconName> = { coin: "coin", diamond: "diamond", ticket: "ticket" };
const AD_COIN_REWARD = 30;
const DAILY_AD_WATCH_CAP = 10;

export default function ShopClient({ rates, coin: initialCoin, diamond: initialDiamond, ticket: initialTicket, exp, greenBanknote, adWatchesToday }: { rates: CurrencyExchangeRow[]; coin: number; diamond: number; ticket: number; exp: number; greenBanknote: number; adWatchesToday: number }) {
  const [coin, setCoin] = useState(initialCoin);
  const [diamond, setDiamond] = useState(initialDiamond);
  const [ticket, setTicket] = useState(initialTicket);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [adLoading, setAdLoading] = useState(false);
  const [adWatches, setAdWatches] = useState(adWatchesToday);

  async function watchAdForCoin() {
    if (adLoading || adWatches >= DAILY_AD_WATCH_CAP) return;
    setAdLoading(true);
    setMessage("");
    try {
      const adResult = await showRewardedAd();
      if (!adResult.success) {
        setMessage(adResult.error ?? "Ad failed to load");
        return;
      }
      const res = await fetch("/api/shop/watch-ad", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        sfx.play("pickup_coin");
        setCoin(data.updatedPlayer.coin);
        setAdWatches(DAILY_AD_WATCH_CAP - data.watchesRemaining);
        setMessage(`+${data.reward} 🪙`);
      } else {
        setMessage(data.error);
      }
    } catch {
      setMessage("Network error — reward not granted.");
    } finally {
      setAdLoading(false);
    }
  }

  const balances: Record<string, number> = { coin, diamond, ticket };

  // v9 #3: the rate is fully known client-side (r.fromAmount/toAmount), so the
  // balance change can be applied optimistically instead of waiting on the
  // Sheets round-trip — rolled back if the server rejects it (e.g. someone
  // else already spent the balance in another tab).
  async function exchange(rate: CurrencyExchangeRow) {
    if (loading) return;
    sfx.play("ui_click");
    setLoading(true);
    setMessage("");

    const prevBalance = { coin, diamond, ticket };
    const apply = (currency: string, delta: number) => {
      if (currency === "coin") setCoin((c) => c + delta);
      else if (currency === "diamond") setDiamond((d) => d + delta);
      else setTicket((t) => t + delta);
    };
    apply(rate.fromCurrency, -rate.fromAmount);
    apply(rate.toCurrency, rate.toAmount);

    try {
      const res = await fetch("/api/shop/exchange", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchangeId: rate.id }),
      });
      const data = await res.json();
      if (data.success) {
        sfx.play("pickup_coin");
        setCoin(data.player.coin);
        setDiamond(data.player.diamond);
        setTicket(data.player.ticket);
        setMessage(`+${data.result.toAmount} ${data.result.toCurrency}`);
      } else {
        setCoin(prevBalance.coin);
        setDiamond(prevBalance.diamond);
        setTicket(prevBalance.ticket);
        setMessage(data.error);
      }
    } catch {
      setCoin(prevBalance.coin);
      setDiamond(prevBalance.diamond);
      setTicket(prevBalance.ticket);
      setMessage("Network error — exchange not completed.");
    } finally {
      setLoading(false);
    }
  }

  function renderGroup(fromCurrency: string, toCurrency: string) {
    const group = rates.filter((r) => r.fromCurrency === fromCurrency && r.toCurrency === toCurrency);
    if (group.length === 0) return null;

    return (
      <div className="card-military">
        <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Icon name={CURRENCY_ICON_NAME[fromCurrency] ?? "coin"} size={16} /> {fromCurrency} → <Icon name={CURRENCY_ICON_NAME[toCurrency] ?? "coin"} size={16} /> {toCurrency}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {group.map((r) => (
            <button
              key={r.id}
              onClick={() => exchange(r)}
              disabled={loading || balances[fromCurrency] < r.fromAmount}
              className="btn-military text-xs py-3 flex flex-col items-center gap-1 disabled:opacity-40"
            >
              <span className="inline-flex items-center gap-1"><Icon name={CURRENCY_ICON_NAME[fromCurrency] ?? "coin"} size={14} /> {r.fromAmount}</span>
              <span className="text-military-gold inline-flex items-center gap-1">→ <Icon name={CURRENCY_ICON_NAME[toCurrency] ?? "coin"} size={14} /> {r.toAmount}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen page-bg-themed p-6">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/home" className="text-military-steel hover:text-white text-sm">← BACK</Link>
        <h1 className="text-2xl font-black text-military-tan uppercase tracking-widest">Trade</h1>
        <div className="ml-auto">
          <CurrencyBar coin={coin} diamond={diamond} ticket={ticket} greenBanknote={greenBanknote} />
        </div>
      </div>

      <p className="max-w-2xl mx-auto text-xs text-military-steel mb-4">
        Direct currency exchange (no randomness) — for random equipment drops, see Gacha instead.
      </p>

      {message && <div className="max-w-2xl mx-auto mb-4 text-military-gold text-sm">{message}</div>}

      <div className="max-w-2xl mx-auto space-y-4">
        <div className="card-military">
          <h2 className="font-bold text-military-tan mb-3 uppercase tracking-wider">📺 Watch Ad → 🪙 {AD_COIN_REWARD}</h2>
          <p className="text-xs text-military-steel mb-3">{adWatches}/{DAILY_AD_WATCH_CAP} watched today</p>
          <button
            onClick={watchAdForCoin}
            disabled={adLoading || adWatches >= DAILY_AD_WATCH_CAP}
            className="btn-gold w-full py-2 text-sm disabled:opacity-40"
          >
            {adLoading ? "Loading ad..." : adWatches >= DAILY_AD_WATCH_CAP ? "Daily limit reached" : `📺 Watch Ad for ${AD_COIN_REWARD} Coin`}
          </button>
        </div>

        {renderGroup("diamond", "coin")}
        {renderGroup("ticket", "diamond")}
        {rates.length === 0 && <p className="text-military-steel text-sm text-center py-12">No exchange rates configured yet.</p>}
      </div>
    </div>
  );
}
