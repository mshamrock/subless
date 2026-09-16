"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Github, X } from "lucide-react";
import { githubSignIn } from "@/lib/actions/auth";
import { MIN_ACCOUNT_AGE_DAYS } from "@/lib/actions/guard";

interface AuthPromptValue {
  signedIn: boolean;
  /**
   * Returns true when the action may proceed. When it returns false the sign-in
   * dialog is already open, so callers simply stop.
   */
  requireAuth: (action?: string) => boolean;
}

const AuthPromptContext = createContext<AuthPromptValue>({
  signedIn: false,
  requireAuth: () => true,
});

export function useAuthPrompt() {
  return useContext(AuthPromptContext);
}

/**
 * One sign-in dialog for the whole site.
 *
 * Every vote, upvote, switch and comment needs an account, and each of those
 * controls used to answer a signed-out click with a disabled button or a small
 * red error. Both are dead ends: they say no without saying what to do about
 * it. Asking at the moment of the click also means the intent is fresh — the
 * person already knows what they wanted, so the dialog only has to say how.
 */
export function AuthPromptProvider({
  signedIn,
  children,
}: {
  signedIn: boolean;
  children: React.ReactNode;
}) {
  const [action, setAction] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const requireAuth = useCallback(
    (what?: string) => {
      if (signedIn) return true;
      setAction(what ?? null);
      setOpen(true);
      return false;
    },
    [signedIn],
  );

  return (
    <AuthPromptContext.Provider value={{ signedIn, requireAuth }}>
      {children}
      {open && <SignInDialog action={action} onClose={() => setOpen(false)} />}
    </AuthPromptContext.Provider>
  );
}

function SignInDialog({ action, onClose }: { action: string | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);

    // Without this the page keeps scrolling behind the dialog on a trackpad
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Back to exactly where they were, fragment included — a shared link that
  // drops you at the top of the page after signing in has lost the thing you
  // came for
  const returnTo =
    typeof window === "undefined"
      ? "/"
      : `${window.location.pathname}${window.location.search}${window.location.hash}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-prompt-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card relative w-full max-w-md p-6 sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-[var(--color-faint)] hover:text-[var(--color-fg)]"
        >
          <X size={16} />
        </button>

        <p className="eyebrow mb-2">Subless account</p>
        <h2 id="auth-prompt-title" className="text-xl font-semibold">
          {action ? `Sign in to ${action}` : "Sign in to continue"}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          Signing in with GitHub is the whole sign-up: no email, no password, nothing to
          confirm. It is how one person gets one vote, and how a build gets a verified author
          badge when the repository is really theirs.
        </p>

        <button
          ref={primaryRef}
          type="button"
          disabled={pending}
          onClick={() => start(() => githubSignIn(returnTo))}
          className="btn-primary mt-5 w-full justify-center"
        >
          <Github size={16} />
          {pending ? "Redirecting to GitHub…" : "Continue with GitHub"}
        </button>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-lg px-4 py-2 text-sm text-[var(--color-faint)] hover:text-[var(--color-fg)]"
        >
          Not now
        </button>

        {/* Said here rather than discovered after signing in and being refused */}
        <p className="mt-4 text-xs text-[var(--color-faint)]">
          Voting needs a GitHub account older than {MIN_ACCOUNT_AGE_DAYS} days. Fresh accounts
          are the cheapest way to stuff a ballot, and the winner gets the homepage.
        </p>
      </div>
    </div>
  );
}
