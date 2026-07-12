import Omise from "omise";

/**
 * Server-only Omise client, authenticated with the secret key. NEVER import
 * this from a "use client" component or expose OMISE_SECRET_KEY to the
 * browser — same boundary as src/lib/supabase/client.ts's service-role key.
 * The public key (safe client-side, used only for Omise.js card tokenization)
 * lives in NEXT_PUBLIC_OMISE_PUBLIC_KEY instead.
 */
let client: ReturnType<typeof Omise> | null = null;

function getOmiseClient() {
  if (client) return client;
  const secretKey = process.env.OMISE_SECRET_KEY;
  if (!secretKey) throw new Error("OMISE_SECRET_KEY is not set");
  client = Omise({ secretKey, omiseVersion: "2019-05-29" });
  return client;
}

export interface ChargeResult {
  id: string;
  status: string;
  paid: boolean;
  /** Only present for PromptPay charges — the QR code image to display. */
  qrImageUrl?: string;
}

function toChargeResult(charge: Omise.Charges.ICharge): ChargeResult {
  const source = charge.source as unknown as Omise.Sources.ISource | undefined;
  return {
    id: charge.id,
    status: charge.status,
    paid: charge.paid,
    qrImageUrl: source?.scannable_code?.image?.download_uri,
  };
}

/** Card charge — `cardToken` comes from Omise.js running in the browser
 *  (Omise.createToken), so the raw card number never touches our server. */
export async function createCardCharge(amountSatang: number, cardToken: string, description: string): Promise<ChargeResult> {
  const omise = getOmiseClient();
  const charge = await omise.charges.create({
    amount: amountSatang,
    currency: "thb",
    card: cardToken,
    description,
  });
  return toChargeResult(charge);
}

/** PromptPay charge — no sensitive data involved, so the source is created
 *  directly in the same call (no separate client-side tokenization needed). */
export async function createPromptPayCharge(amountSatang: number, description: string): Promise<ChargeResult> {
  const omise = getOmiseClient();
  const charge = await omise.charges.create({
    amount: amountSatang,
    currency: "thb",
    source: { type: "promptpay", amount: amountSatang, currency: "thb" },
    description,
  });
  return toChargeResult(charge);
}

/** Independently re-fetches a charge's real status from Omise — this is the
 *  actual webhook verification step (Omise doesn't sign webhook payloads the
 *  way Stripe does, so the payload's own "status" is never trusted). */
export async function retrieveCharge(chargeId: string): Promise<ChargeResult> {
  const omise = getOmiseClient();
  const charge = await omise.charges.retrieve(chargeId);
  return toChargeResult(charge);
}
