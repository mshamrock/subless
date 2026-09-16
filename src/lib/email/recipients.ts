import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { BRAND } from "@/lib/brand";

export interface Recipient {
  email: string;
  unsubscribeUrl: string;
}

/**
 * Resolves someone to a mailable address, or to nothing.
 *
 * Returns null when they have no address or have opted out, so every caller
 * fails closed: forgetting this check should mean no mail, never mail to
 * someone who asked not to receive it.
 */
export async function resolveRecipient(userId: string): Promise<Recipient | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.email || !user.emailOptIn) return null;

  // Minted on first send rather than at signup, so accounts that never receive
  // mail never carry a token that could leak
  let token = user.unsubscribeToken;
  if (!token) {
    token = randomBytes(24).toString("base64url");
    await db.update(users).set({ unsubscribeToken: token }).where(eq(users.id, userId));
  }

  return {
    email: user.email,
    unsubscribeUrl: `${BRAND.url}/api/unsubscribe?token=${token}`,
  };
}
