import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { targets } from "@/lib/db/schema";

/**
 * Serves a stored product icon from our own origin.
 * Icons change roughly never, so they are cached hard; a rebrand is handled by
 * re-running the icon backfill, which changes the bytes behind the same URL.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await db
    .select({ data: targets.logoData, contentType: targets.logoContentType })
    .from(targets)
    .where(eq(targets.slug, slug))
    .limit(1);

  if (!row?.data || !row.contentType) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
