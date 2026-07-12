import { getConfigRows } from "../db/configCache";

const SHEET = "TicketTopUp";

export interface TicketTopUpRow {
  id: string;
  priceBaht: number;
  ticketAmount: number;
}

function rowToTopUp(row: Record<string, string>): TicketTopUpRow {
  return {
    id: row.id,
    priceBaht: Number(row.priceBaht || 0),
    ticketAmount: Number(row.ticketAmount || 0),
  };
}

export async function getAllTopUpPackages(): Promise<TicketTopUpRow[]> {
  const rows = await getConfigRows(SHEET);
  return rows.map(rowToTopUp).sort((a, b) => a.priceBaht - b.priceBaht);
}
