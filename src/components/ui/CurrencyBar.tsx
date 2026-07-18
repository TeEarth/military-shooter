"use client";

import Icon from "./Icon";

/** v16: the 4 official resources — coin/diamond/ticket plus the green
 *  banknote (v4 #5 boss/mission payout, 1 banknote = 1 THB, manual payout
 *  only). exp is no longer shown as its own currency — every exp grant now
 *  feeds VIP progress directly (see db/player.ts addCurrency), which is
 *  displayed via the VIP badge instead. greenBanknote is optional so pages
 *  that only have partial player data (e.g. a fetch that never loaded
 *  income) can still render the 3 core currencies without crashing. */
export default function CurrencyBar({
  coin,
  diamond,
  ticket,
  greenBanknote,
}: {
  coin: number;
  diamond: number;
  ticket: number;
  greenBanknote?: number;
}) {
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <div className="flex items-center gap-1">
        <Icon name="coin" size={18} />
        <span className="text-military-gold font-bold">{coin.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon name="diamond" size={18} />
        <span className="text-blue-400 font-bold">{diamond.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <Icon name="ticket" size={18} />
        <span className="text-green-400 font-bold">{ticket.toLocaleString()}</span>
      </div>
      {greenBanknote !== undefined && (
        <div className="flex items-center gap-1">
          <Icon name="banknote" size={18} />
          <span className="text-emerald-400 font-bold">{greenBanknote.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
