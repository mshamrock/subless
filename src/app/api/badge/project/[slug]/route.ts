import { renderBadge } from "@/lib/badge";
import { getProjectBadgeState } from "@/lib/queries";

/**
 * The SVG a contributor pastes into their README.
 *
 * It is served to GitHub's image proxy, not to a browser, so it caches for a
 * few minutes: long enough that a popular repository does not hammer the
 * database, short enough that "vote" disappears within the hour of a challenge
 * closing rather than asking for votes that can no longer be cast.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const state = await getProjectBadgeState(slug);

  const message = !state
    ? "free alternatives"
    : state.live
      ? state.live.contestStatus === "voting"
        ? "vote for this build"
        : "in this week's challenge"
      : state.replaces
        ? `free ${state.replaces} alternative`
        : "free alternative";

  return new Response(renderBadge({ label: "subless", message }), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
