import { getCachedSheet } from "./cache";
import { addCurrency } from "../db/player";

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
  const { rows } = await getCachedSheet(SHEET);
  return rows.map(rowToTopUp).sort((a, b) => a.priceBaht - b.priceBaht);
}

/**
 * Mock top-up — no real payment gateway is connected yet. Calling this
 * immediately grants tickets so the client purchase flow can be built and
 * tested end-to-end. Swap the body of this handler for a real payment
 * gateway webhook (TrueMoney, Omise, Stripe, etc.) before launch.
 */
export async function mockTopUp(playerId: string, packageId: string): Promise<{ ticketAmount: number }> {
  const packages = await getAllTopUpPackages();
  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) throw new Error("Top-up package not found");

  await addCurrency(playerId, { ticket: pkg.ticketAmount });
  return { ticketAmount: pkg.ticketAmount };
}
