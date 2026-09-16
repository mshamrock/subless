import { ogCard, OG_SIZE } from "@/lib/og/card";
import { getTargetBySlug, getTargetSwitchCount } from "@/lib/queries";
import { goSublessOn } from "@/lib/brand";
import { formatYearly } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Free alternatives";

export default async function Image({ params }: { params: { slug: string } }) {
  const target = await getTargetBySlug(params.slug);
  if (!target) return ogCard({ eyebrow: "Subless", title: "Free alternatives" });

  const switched = await getTargetSwitchCount(target.id).catch(() => 0);

  return ogCard({
    eyebrow: "Go Subless",
    title: goSublessOn(target.name),
    subtitle: switched
      ? `${switched} ${switched === 1 ? "person has" : "people have"} already stopped paying`
      : "Free, community-built alternatives",
    figure: target.monthlyPriceUsd ? formatYearly(target.monthlyPriceUsd) : undefined,
  });
}
