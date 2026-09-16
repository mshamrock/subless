import { NextResponse } from "next/server";
import { runWeeklyTick } from "@/lib/cycle";
import { sendWeeklyDigest } from "@/lib/email/weekly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Недельный тик. Вызывается Vercel Cron по расписанию из vercel.json.
 * Защищён CRON_SECRET — иначе кто угодно мог бы досрочно закрыть голосование.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET не задан" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runWeeklyTick("cron");

    // Sent after the tick, so the digest describes the week that just began.
    // A mail failure must not make the cron look failed — the cycle already moved.
    let digest: unknown = null;
    try {
      digest = await sendWeeklyDigest();
    } catch (e) {
      digest = { error: e instanceof Error ? e.message : String(e) };
    }

    return NextResponse.json({ ok: true, ...result, digest });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
