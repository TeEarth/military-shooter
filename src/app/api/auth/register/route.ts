import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPlayer } from "@/lib/google/player";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = schema.parse(body);

    await createPlayer({ email, username: name ?? "Soldier", password });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
