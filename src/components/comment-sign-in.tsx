"use client";

import { useAuthPrompt } from "./auth-prompt";

/**
 * The comment box as it looks before signing in.
 *
 * It is the box rather than a notice about the box: the invitation to say
 * something is what makes people want an account, and the dialog asks for one
 * the moment they act on it.
 */
export function CommentSignIn({ placeholder }: { placeholder: string }) {
  const { requireAuth } = useAuthPrompt();

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => requireAuth("join the discussion")}
        className="input text-left text-[var(--color-faint)]"
      >
        {placeholder}
      </button>
      <p className="text-xs text-[var(--color-faint)]">
        Sign in with GitHub to post — no email, no password.
      </p>
    </div>
  );
}
