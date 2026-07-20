import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDailyLoginStatus } from "@/lib/db/dailyLogin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const status = await getDailyLoginStatus(session.user.id);
    return NextResponse.json({ success: true, ...status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
