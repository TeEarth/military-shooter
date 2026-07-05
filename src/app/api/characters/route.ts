import { NextRequest, NextResponse } from "next/server";
import { getAllCharacters } from "@/lib/google/character";

export async function GET(req: NextRequest) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  const characters = await getAllCharacters({ force: fresh });
  return NextResponse.json({ success: true, data: characters });
}
