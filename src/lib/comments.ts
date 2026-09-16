import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { contests, projects } from "@/lib/db/schema";
import type { CommentSubject } from "@/lib/db/schema";

export interface SubjectRef {
  title: string;
  slug: string;
  /** Who should hear about a top-level comment, if anyone. */
  ownerId: string | null;
  href: string;
}

/**
 * Resolves what a comment is attached to. Notifications store the title and
 * slug at write time so the list can render and link without joining every
 * subject table on read — and so a renamed project does not rewrite history.
 */
export async function resolveSubject(
  subjectType: CommentSubject,
  subjectId: number,
): Promise<SubjectRef | null> {
  if (subjectType === "project") {
    const [row] = await db
      .select({ title: projects.name, slug: projects.slug, ownerId: projects.submittedById })
      .from(projects)
      .where(eq(projects.id, subjectId))
      .limit(1);
    return row ? { ...row, href: `/projects/${row.slug}` } : null;
  }

  const [row] = await db
    .select({ title: contests.title, slug: contests.slug })
    .from(contests)
    .where(eq(contests.id, subjectId))
    .limit(1);
  return row ? { ...row, ownerId: null, href: `/challenges/${row.slug}` } : null;
}

export function subjectHref(subjectType: string, slug: string): string {
  return subjectType === "project" ? `/projects/${slug}` : `/challenges/${slug}`;
}
