import type { Metadata } from "next";
import { SignInButton } from "@/components/auth-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  return (
    <div className="mx-auto max-w-md py-16">
      <div className="card space-y-5 p-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Sign in with GitHub</h1>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          There is no other way in, deliberately. GitHub lets us verify that a repository is
          really yours, and keeps freshly created accounts out of the voting.
        </p>
        <SignInButton redirectTo={callbackUrl} className="mx-auto" />
      </div>
    </div>
  );
}
