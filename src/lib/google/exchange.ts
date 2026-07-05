import { getCachedSheet } from "./cache";
import { getPlayerById, updatePlayer } from "./player";

const SHEET = "CurrencyExchangeConfig";

export type ExchangeCurrency = "coin" | "diamond" | "ticket";

export interface CurrencyExchangeRow {
  id: string;
  fromCurrency: ExchangeCurrency;
  fromAmount: number;
  toCurrency: ExchangeCurrency;
  toAmount: number;
}

function rowToExchange(row: Record<string, string>): CurrencyExchangeRow {
  return {
    id: row.id,
    fromCurrency: (row.fromCurrency || "diamond") as ExchangeCurrency,
    fromAmount: Number(row.fromAmount || 0),
    toCurrency: (row.toCurrency || "coin") as ExchangeCurrency,
    toAmount: Number(row.toAmount || 0),
  };
}

export async function getAllExchangeRates(): Promise<CurrencyExchangeRow[]> {
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToExchange);
}

/** Direct (non-random) currency exchange — separate from Gacha, which only rolls equipment. Atomic: checks balance before deducting. */
export async function exchangeCurrency(playerId: string, exchangeId: string): Promise<{ toCurrency: ExchangeCurrency; toAmount: number }> {
  const rates = await getAllExchangeRates();
  const rate = rates.find((r) => r.id === exchangeId);
  if (!rate) throw new Error("Exchange rate not found");

  const player = await getPlayerById(playerId);
  if (!player) throw new Error("Player not found");

  const fromBalance = player[rate.fromCurrency];
  if (fromBalance < rate.fromAmount) throw new Error(`Not enough ${rate.fromCurrency}`);

  await updatePlayer(playerId, {
    [rate.fromCurrency]: fromBalance - rate.fromAmount,
    [rate.toCurrency]: player[rate.toCurrency] + rate.toAmount,
  });

  return { toCurrency: rate.toCurrency, toAmount: rate.toAmount };
}
