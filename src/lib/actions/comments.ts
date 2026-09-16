"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { comments, notifications } from "@/lib/db/schema";
import type { CommentSubject } from "@/lib/db/schema";
import { auth, requireUser } from "@/lib/auth";
import { resolveSubject, subjectHref } from "@/lib/comments";
import { BRAND } from "@/lib/brand";
import { sendEmail } from "@/lib/email/send";
import { resolveRecipient } from "@/lib/email/recipients";
import { projectCommentEmail, replyEmail } from "@/lib/email/templates";
import { toActionError, type ActionResult } from "./guard";

const bodySchema = z
  .string()
  .trim()
  .min(2, "That is a little short")
  .max(4000, "Comments are capped at 4000 characters");

export async function postComment(
  subjectType: CommentSubject,
  subjectId: number,
  body: string,
  parentId?: number,
): Promise<ActionResult> {
  try {
    const user = await requireUser();

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const subject = await resolveSubject(subjectType, subjectId);
    if (!subject) return { ok: false, error: "Nothing to comment on here" };

    /**
     * Threads stay one level deep: replying to a reply attaches to the same
     * top-level comment rather than nesting further.
     */
    let rootId: number | null = null;
    let notifyUserId: string | null = null;

    if (parentId) {
      const [parent] = await db
        .select()
        .from(comments)
        .where(eq(comments.id, parentId))
        .limit(1);

      if (!parent || parent.subjectId !== subjectId || parent.subjectType !== subjectType) {
        return { ok: false, error: "That comment is not part of this discussion" };
      }
      rootId = parent.parentId ?? parent.id;
      notifyUserId = parent.authorId;
    }

    const [created] = await db
      .insert(comments)
      .values({ subjectType, subjectId, parentId: rootId, authorId: user.id, body: parsed.data })
      .returning();

    const actor = user.name ?? user.githubLogin ?? "Someone";
    const url = `${BRAND.url}${subjectHref(subjectType, subject.slug)}#comment-${created.id}`;

    // Replying to your own comment should not ping you
    if (notifyUserId && notifyUserId !== user.id) {
      await db.insert(notifications).values({
        userId: notifyUserId,
        actorId: user.id,
        type: "reply",
        commentId: created.id,
        subjectType,
        subjectId,
        subjectTitle: subject.title,
        subjectSlug: subject.slug,
      });

      // Mail mirrors the bell but never blocks the comment from being posted
      void notifyByEmail(notifyUserId, (recipient) =>
        replyEmail({
          to: recipient.email,
          actor,
          subjectTitle: subject.title,
          excerpt: parsed.data,
          url,
          unsubscribeUrl: recipient.unsubscribeUrl,
        }),
      );
    }

    // A top-level comment is news for whoever owns the thing being discussed
    if (!parentId && subject.ownerId && subject.ownerId !== user.id) {
      await db.insert(notifications).values({
        userId: subject.ownerId,
        actorId: user.id,
        type: "comment_on_project",
        commentId: created.id,
        subjectType,
        subjectId,
        subjectTitle: subject.title,
        subjectSlug: subject.slug,
      });

      void notifyByEmail(subject.ownerId, (recipient) =>
        projectCommentEmail({
          to: recipient.email,
          actor,
          subjectTitle: subject.title,
          excerpt: parsed.data,
          url,
          unsubscribeUrl: recipient.unsubscribeUrl,
        }),
      );
    }

    revalidatePath(subject.href);
    return { ok: true, message: parentId ? "Reply posted" : "Comment posted" };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Soft delete: the row stays so replies underneath it keep their place in the
 * thread, and the UI renders a tombstone instead of the text.
 */
export async function deleteComment(commentId: number): Promise<ActionResult> {
  try {
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return { ok: false, error: "You need to sign in" };

    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1);
    if (!comment) return { ok: false, error: "Comment not found" };

    if (comment.authorId !== user.id && !user.isAdmin) {
      return { ok: false, error: "You can only delete your own comments" };
    }

    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, commentId));

    const subject = await resolveSubject(comment.subjectType as CommentSubject, comment.subjectId);
    if (subject) revalidatePath(subject.href);

    return { ok: true, message: "Comment deleted" };
  } catch (e) {
    return toActionError(e);
  }
}

export async function markNotificationsRead(): Promise<ActionResult> {
  try {
    const user = await requireUser();
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}

/**
 * Best-effort mail. A failed send is logged and dropped: the in-app notification
 * is already written, and losing a comment because a mail provider had a bad
 * minute would be a far worse outcome than a missed email.
 */
async function notifyByEmail(
  userId: string,
  build: (recipient: { email: string; unsubscribeUrl: string }) => Parameters<typeof sendEmail>[0],
) {
  try {
    const recipient = await resolveRecipient(userId);
    if (!recipient) return;
    const result = await sendEmail(build(recipient));
    if (!result.ok) console.error("[email] notification failed:", result.error);
  } catch (e) {
    console.error("[email] notification threw:", e);
  }
}
