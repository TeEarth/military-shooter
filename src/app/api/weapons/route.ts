import { NextResponse } from "next/server";
import { getAllWeapons } from "@/lib/google/weapon";

export async function GET() {
  const weapons = await getAllWeapons();
  return NextResponse.json({ success: true, data: weapons });
}
