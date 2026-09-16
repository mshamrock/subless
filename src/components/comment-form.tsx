"use client";

import { useRef, useState, useTransition } from "react";
import { postComment } from "@/lib/actions/comments";
import type { CommentSubject } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

export function CommentForm({
  subjectType,
  subjectId,
  parentId,
  placeholder = "Add a comment",
  autoFocus,
  onDone,
  compact,
}: {
  subjectType: CommentSubject;
  subjectId: number;
  parentId?: number;
  placeholder?: string;
  autoFocus?: boolean;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const body = ref.current?.value ?? "";
    start(async () => {
      setError(null);
      const res = await postComment(subjectType, subjectId, body, parentId);
      if (res.ok) {
        // Only clear on success — a rejected comment should not vanish
        if (ref.current) ref.current.value = "";
        onDone?.();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={ref}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="input resize-y"
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter submits, matching every other comment box people use
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
      />

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className={cn("btn-primary", compact && "px-3 py-1.5 text-xs")}
        >
          {pending ? "Posting…" : parentId ? "Reply" : "Comment"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Cancel
          </button>
        )}
        <span className="mono text-[11px] text-[var(--color-faint)]">⌘↵ to post</span>
      </div>
    </div>
  );
}
