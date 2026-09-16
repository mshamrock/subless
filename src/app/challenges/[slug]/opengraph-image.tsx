import { ogCard, OG_SIZE } from "@/lib/og/card";
import { getContestBySlug } from "@/lib/queries";
import { formatYearly } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Subless Challenge";

export default async function Image({ params }: { params: { slug: string } }) {
  const challenge = await getContestBySlug(params.slug);
  if (!challenge) return ogCard({ eyebrow: "Subless", title: "Subless Challenge" });

  return ogCard({
    eyebrow: "This week's Subless Challenge",
    title: challenge.title,
    subtitle: challenge.brief.slice(0, 120),
    figure: challenge.targetPrice ? formatYearly(challenge.targetPrice) : undefined,
  });
}
