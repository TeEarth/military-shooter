import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimMission } from "@/lib/db/mission";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { missionId } = await req.json();

  try {
    const result = await claimMission(session.user.id, missionId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
