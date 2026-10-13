import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";

/**
 * Serves a stored project icon from our own origin, so a page listing builds
 * never sends its visitors to GitHub or anyone else to draw a logo.
 *
 * The sandbox policy is for the one format that can carry a script: opened
 * directly rather than through an <img>, an SVG would otherwise run as a page
 * on this origin. Through an <img> it changes nothing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const [row] = await db
    .select({ data: projects.logoData, contentType: projects.logoContentType })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);

  if (!row?.data || !row.contentType) {
    return new Response(null, { status: 404 });
  }

  return new Response(Buffer.from(row.data, "base64"), {
    headers: {
      "Content-Type": row.contentType,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
