import { ogCard, OG_SIZE } from "@/lib/og/card";
import { getProjectBySlug } from "@/lib/queries";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A community-built alternative";

export default async function Image({ params }: { params: { slug: string } }) {
  const project = await getProjectBySlug(params.slug);
  if (!project) return ogCard({ eyebrow: "Subless", title: "Community alternatives" });

  const replaces = project.targets.map((t) => t.name).join(", ");

  return ogCard({
    eyebrow: replaces ? `Free alternative to ${replaces}` : "Community build",
    title: project.name,
    subtitle: project.tagline,
  });
}
