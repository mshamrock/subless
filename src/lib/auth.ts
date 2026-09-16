import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import type { Adapter } from "next-auth/adapters";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { fetchGithubUser } from "@/lib/github";

function adminLogins(): string[] {
  return (process.env.ADMIN_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Build the adapter on first use rather than at import time, so merely importing
 * this module never opens a database connection. `next build` imports every route
 * across several workers, and an eager connection had them all contending for the
 * same local PGlite directory.
 *
 * Our table names differ from the adapter defaults, hence the explicit mapping.
 * The adapter is typed against its own schema shape; the runtime contract matches.
 */
function lazyAdapter(): Adapter {
  let resolved: Adapter | undefined;
  const get = () => {
    resolved ??= DrizzleAdapter(db as Parameters<typeof DrizzleAdapter>[0], {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    } as Parameters<typeof DrizzleAdapter>[1]);
    return resolved;
  };

  return new Proxy({} as Adapter, {
    get: (_t, prop) => Reflect.get(get(), prop),
    has: (_t, prop) => Reflect.has(get(), prop),
    ownKeys: () => Reflect.ownKeys(get()),
    getOwnPropertyDescriptor: (_t, prop) =>
      Reflect.getOwnPropertyDescriptor(get(), prop),
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: lazyAdapter(),
  providers: [
    GitHub({
      // public_repo is what lets us verify repo ownership at submission time
      authorization: { params: { scope: "read:user user:email public_repo" } },
    }),
  ],
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  callbacks: {
    async session({ session, user }) {
      const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
      session.user.id = user.id;
      session.user.githubLogin = row?.githubLogin ?? null;
      session.user.isAdmin = row?.isAdmin ?? false;
      session.user.githubCreatedAt = row?.githubCreatedAt ?? null;
      return session;
    },
  },
  events: {
    /**
      * Pull the GitHub profile once at sign-in: the login for links, and the
      * account creation date as a signal against vote-stuffing with fresh accounts.
      */
    async signIn({ user, profile }) {
      if (!user.id) return;
      const login = (profile?.login as string | undefined) ?? null;
      if (!login) return;

      const gh = await fetchGithubUser(login).catch(() => null);
      await db
        .update(users)
        .set({
          githubLogin: login,
          githubId: gh?.id ?? (profile?.id as number | undefined) ?? null,
          githubCreatedAt: gh?.created_at ? new Date(gh.created_at) : null,
          isAdmin: adminLogins().includes(login.toLowerCase()),
        })
        .where(eq(users.id, user.id));
    },
  },
});

/** The user's access token — needed to verify repository permissions. */
export async function getUserGithubToken(userId: string): Promise<string | null> {
  const [acc] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return acc?.access_token ?? null;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("FORBIDDEN");
  return user;
}
