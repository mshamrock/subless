"use server";

import { signIn, signOut } from "@/lib/auth";

export async function githubSignIn(redirectTo?: string) {
  await signIn("github", { redirectTo: redirectTo || "/" });
}

export async function appSignOut() {
  await signOut({ redirectTo: "/" });
}
