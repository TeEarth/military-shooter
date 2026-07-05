"use client";

/** v10 #4: the 5 official resources — coin/diamond/ticket plus exp and the
 *  green banknote (v4 #5 boss/mission payout, 1 banknote = 1 THB, manual
 *  payout only). exp/greenBanknote are optional so pages that only have
 *  partial player data (e.g. a fetch that never loaded income) can still
 *  render the 3 core currencies without crashing. */
export default function CurrencyBar({
  coin,
  diamond,
  ticket,
  exp,
  greenBanknote,
}: {
  coin: number;
  diamond: number;
  ticket: number;
  exp?: number;
  greenBanknote?: number;
}) {
  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <div className="flex items-center gap-1">
        <span>🪙</span>
        <span className="text-military-gold font-bold">{coin.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>💎</span>
        <span className="text-blue-400 font-bold">{diamond.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1">
        <span>🎟️</span>
        <span className="text-green-400 font-bold">{ticket.toLocaleString()}</span>
      </div>
      {exp !== undefined && (
        <div className="flex items-center gap-1">
          <span>⭐</span>
          <span className="text-purple-300 font-bold">{exp.toLocaleString()}</span>
        </div>
      )}
      {greenBanknote !== undefined && (
        <div className="flex items-center gap-1">
          <span>💵</span>
          <span className="text-emerald-400 font-bold">{greenBanknote.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
