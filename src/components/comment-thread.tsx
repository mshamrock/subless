import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth";
import { getComments } from "@/lib/queries";
import type { CommentSubject } from "@/lib/db/schema";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";
import { SignInButton } from "./auth-buttons";
import { plural } from "@/lib/utils";

export async function CommentThread({
  subjectType,
  subjectId,
  returnTo,
  prompt = "Add a comment",
}: {
  subjectType: CommentSubject;
  subjectId: number;
  returnTo: string;
  prompt?: string;
}) {
  const [session, thread] = await Promise.all([
    auth(),
    getComments(subjectType, subjectId),
  ]);

  const user = session?.user;
  const visible = countVisible(thread);

  return (
    <section className="card p-6">
      <h2 className="eyebrow mb-5 flex items-center gap-2">
        <MessageSquare size={14} />
        Discussion · {visible} {plural(visible, "comment", "comments")}
      </h2>

      {user ? (
        <CommentForm subjectType={subjectType} subjectId={subjectId} placeholder={prompt} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="text-sm text-[var(--color-muted)]">
            Sign in with GitHub to join the discussion.
          </p>
          <SignInButton redirectTo={returnTo} />
        </div>
      )}

      {thread.length > 0 && (
        <div className="mt-8 space-y-6">
          {thread.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              subjectType={subjectType}
              subjectId={subjectId}
              currentUserId={user?.id ?? null}
              isAdmin={user?.isAdmin ?? false}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A deleted comment still occupies the thread, but it is not a comment any more. */
function countVisible(nodes: { deletedAt: Date | null; replies: { deletedAt: Date | null }[] }[]) {
  return nodes.reduce(
    (total, node) =>
      total +
      (node.deletedAt ? 0 : 1) +
      node.replies.filter((r) => !r.deletedAt).length,
    0,
  );
}
