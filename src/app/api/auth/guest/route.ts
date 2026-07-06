import { NextResponse } from "next/server";
import { createPlayer } from "@/lib/db/player";

export async function POST() {
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const email = `guest_${token}@guest.local`;

  await createPlayer({ email, username: "Guest", password: token, isGuest: true });

  return NextResponse.json({ token, email });
}
