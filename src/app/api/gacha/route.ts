import { NextResponse } from "next/server";
import { getGachaPools } from "@/lib/google/gacha";

export async function GET() {
  const pools = await getGachaPools();
  return NextResponse.json({ success: true, data: pools });
}
