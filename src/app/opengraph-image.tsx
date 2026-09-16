import { ogCard, OG_SIZE } from "@/lib/og/card";
import { getSiteStats } from "@/lib/queries";
import { formatMoneyCompact } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

/** The card shows a live figure, so it is regenerated hourly rather than at build. */
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = BRAND.tagline;

export default async function Image() {
  const stats = await getSiteStats().catch(() => null);

  return ogCard({
    eyebrow: "Subless",
    title: BRAND.tagline,
    subtitle: "Vote for the subscriptions you want replaced. Build free alternatives together.",
    figure: stats?.annualReplacedUsd
      ? `${formatMoneyCompact(stats.annualReplacedUsd)}/year replaced`
      : undefined,
  });
}
