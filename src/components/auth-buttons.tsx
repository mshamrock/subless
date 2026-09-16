"use client";

import { useTransition } from "react";
import { Github, LogOut } from "lucide-react";
import { appSignOut, githubSignIn } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export function SignInButton({
  redirectTo,
  className,
  label = "Sign in with GitHub",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => githubSignIn(redirectTo))}
      className={cn("btn-ghost", className)}
    >
      <Github size={16} />
      {pending ? "Redirecting to GitHub…" : label}
    </button>
  );
}

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => appSignOut())}
      title="Sign out"
      className="rounded-lg p-2 text-[var(--color-faint)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
    >
      <LogOut size={16} />
    </button>
  );
}
