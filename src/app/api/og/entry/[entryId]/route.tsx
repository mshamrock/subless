import { ogEntryCard, ogCard } from "@/lib/og/card";
import { getEntryShareCard } from "@/lib/queries";
import { formatMoney, formatYearly } from "@/lib/utils";

/**
 * The preview image for a shared entry.
 *
 * A route rather than a colocated `opengraph-image`, because which entry is
 * being shared lives in the query string, and colocated image files never see
 * it — they only get the route params.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> },
) {
  const { entryId } = await params;
  const entry = await getEntryShareCard(Number(entryId));

  if (!entry) {
    return ogCard({ eyebrow: "Subless", title: "Subless Challenge" });
  }

  return ogEntryCard({
    projectName: entry.projectName,
    targetName: entry.targetName,
    yearly: entry.targetPrice != null ? formatYearly(entry.targetPrice) : null,
    // Rounded: the card is a poster, and "$6.91/mo" spends a reader's attention
    // on two digits that change nothing about the decision
    monthly: entry.targetPrice != null ? formatMoney(Math.round(entry.targetPrice)) : null,
    authorLogin: entry.authorLogin,
  });
}
