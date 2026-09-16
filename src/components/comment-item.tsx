"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Reply, Trash2 } from "lucide-react";
import { deleteComment } from "@/lib/actions/comments";
import { CommentForm } from "./comment-form";
import { Avatar } from "./avatar";
import type { CommentNode } from "@/lib/queries";
import type { CommentSubject } from "@/lib/db/schema";
import { formatDate } from "@/lib/utils";

export function CommentItem({
  comment,
  subjectType,
  subjectId,
  currentUserId,
  isAdmin,
  isReply = false,
}: {
  comment: CommentNode;
  subjectType: CommentSubject;
  subjectId: number;
  currentUserId: string | null;
  isAdmin: boolean;
  isReply?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();

  const deleted = Boolean(comment.deletedAt);
  const canDelete = !deleted && (comment.authorId === currentUserId || isAdmin);
  const displayName = comment.authorName ?? comment.authorLogin ?? "someone";

  return (
    <article id={`comment-${comment.id}`} className="scroll-mt-24">
      <div className="flex gap-3">
        <Avatar
          src={deleted ? null : comment.authorImage}
          name={displayName}
          size={isReply ? 24 : 32}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {deleted ? (
              <span className="text-sm text-[var(--color-faint)]">deleted</span>
            ) : (
              <>
                {comment.authorLogin ? (
                  <Link
                    href={`/builders/${comment.authorLogin}`}
                    className="text-sm font-semibold hover:text-[var(--color-acid)]"
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">{displayName}</span>
                )}
              </>
            )}
            <span className="mono text-xs text-[var(--color-faint)]">
              {formatDate(comment.createdAt)}
            </span>
          </div>

          <p
            className={
              deleted
                ? "mt-1 text-sm italic text-[var(--color-faint)]"
                : "mt-1 whitespace-pre-line text-sm leading-relaxed text-[var(--color-fg)]"
            }
          >
            {deleted ? "This comment was removed." : comment.body}
          </p>

          <div className="mt-2 flex items-center gap-3">
            {currentUserId && !deleted && (
              <button
                type="button"
                onClick={() => setReplying((v) => !v)}
                className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <Reply size={12} /> Reply
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (confirm("Delete this comment?")) {
                    start(async () => {
                      await deleteComment(comment.id);
                    });
                  }
                }}
                className="flex items-center gap-1 text-xs text-[var(--color-faint)] hover:text-[var(--color-danger)]"
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>

          {replying && (
            <div className="mt-3">
              <CommentForm
                subjectType={subjectType}
                subjectId={subjectId}
                parentId={comment.id}
                placeholder={`Reply to ${displayName}`}
                autoFocus
                compact
                onDone={() => setReplying(false)}
              />
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-4 space-y-4 border-l border-[var(--color-border)] pl-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  subjectType={subjectType}
                  subjectId={subjectId}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
