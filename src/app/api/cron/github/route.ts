import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { PUBLIC_TAG } from "@/lib/public-cache";
import { syncAllProjects } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Ежедневная синхронизация метрик GitHub и пересчёт рейтинга. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET не задан" }, { status: 500 });
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllProjects();
  revalidateTag(PUBLIC_TAG);
  // result.ok — это счётчик успешных синхронизаций, не флаг ответа
  return NextResponse.json({ success: true, ...result });
}
