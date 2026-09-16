import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      githubLogin: string | null;
      isAdmin: boolean;
      githubCreatedAt: Date | null;
    } & DefaultSession["user"];
  }
}
