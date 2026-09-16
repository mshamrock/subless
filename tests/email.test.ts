import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveRecipient } from "@/lib/email/recipients";
import { sendEmail } from "@/lib/email/send";
import { replyEmail, weeklyEmail } from "@/lib/email/templates";
import { makeUser, migrate, reset } from "./helpers";

beforeAll(async () => {
  await migrate();
});
beforeEach(async () => {
  await reset();
  vi.restoreAllMocks();
});

const unsub = "https://gosubless.com/api/unsubscribe?token=x";

describe("recipient resolution", () => {
  it("returns nothing for someone who opted out", async () => {
    const id = await makeUser("anna");
    await db.update(users).set({ email: "a@example.com", emailOptIn: false }).where(eq(users.id, id));
    expect(await resolveRecipient(id)).toBeNull();
  });

  it("returns nothing for someone with no address", async () => {
    const id = await makeUser("pavel");
    expect(await resolveRecipient(id)).toBeNull();
  });

  it("mints an unsubscribe token on first send and reuses it after", async () => {
    const id = await makeUser("lena");
    await db.update(users).set({ email: "l@example.com" }).where(eq(users.id, id));

    const first = await resolveRecipient(id);
    const second = await resolveRecipient(id);

    expect(first?.unsubscribeUrl).toContain("token=");
    expect(second?.unsubscribeUrl).toBe(first?.unsubscribeUrl);
  });
});

describe("sendEmail", () => {
  it("sends nothing and reports a dry run when no API key is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    vi.spyOn(console, "info").mockImplementation(() => {});

    const result = await sendEmail({
      to: "a@example.com", subject: "s", html: "<p>h</p>", text: "t",
    });

    expect(result).toEqual({ ok: true, delivered: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("templates", () => {
  it("escapes author-supplied text so a comment cannot inject markup", async () => {
    const mail = replyEmail({
      to: "a@example.com",
      actor: '<img src=x onerror="alert(1)">',
      subjectTitle: "Excalidraw",
      excerpt: "<script>steal()</script>",
      url: "https://gosubless.com/projects/x",
      unsubscribeUrl: unsub,
    });

    // What matters is that no author-supplied string can open a tag; the escaped
    // text still contains the words, and inert text is the correct outcome
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("puts an unsubscribe link in both the html and plain-text bodies", async () => {
    const mail = weeklyEmail({
      to: "a@example.com",
      building: { title: "Miro alternative", slug: "miro" },
      voting: null,
      winner: null,
      unsubscribeUrl: unsub,
    });

    expect(mail.html).toContain(unsub);
    expect(mail.text).toContain(unsub);
  });

  it("keeps the digest free of the visual grammar of marketing", async () => {
    // Gmail files dark cards with big coloured CTA buttons under Promotions
    // regardless of content, so these are properties worth asserting
    const mail = weeklyEmail({
      to: "a@example.com",
      building: { title: "Miro alternative", slug: "miro" },
      voting: null,
      winner: null,
      unsubscribeUrl: unsub,
    });

    expect(mail.html).not.toMatch(/background:#c9f24d/);
    expect(mail.html).not.toMatch(/border-radius:8px;background/);
    expect(mail.html).toContain("background:#ffffff");
  });

  it("does not mark a reply notification as list mail", async () => {
    // List-Unsubscribe headers tell Gmail "this is a mailing list". Correct for a
    // digest; wrong for a 1:1 reply, which belongs in the primary inbox
    const mail = replyEmail({
      to: "a@example.com", actor: "Pavel", subjectTitle: "Excalidraw",
      excerpt: "nice", url: "https://gosubless.com/x", unsubscribeUrl: unsub,
    });
    expect(mail.unsubscribeUrl).toBeUndefined();
    expect(mail.text).toContain(unsub);
  });

  it("carries a one-click unsubscribe url for the List-Unsubscribe headers", async () => {
    const mail = weeklyEmail({
      to: "a@example.com",
      building: { title: "Miro alternative", slug: "miro" },
      voting: null,
      winner: null,
      unsubscribeUrl: unsub,
    });
    expect(mail.unsubscribeUrl).toBe(unsub);
  });

  it("leads with the winner when there is one", async () => {
    const mail = weeklyEmail({
      to: "a@example.com",
      building: { title: "Airtable alternative", slug: "airtable" },
      voting: { title: "Miro alternative", slug: "miro" },
      winner: { challenge: "Gyazo alternative", project: "Flameshot", slug: "flameshot" },
      unsubscribeUrl: unsub,
    });

    expect(mail.subject).toBe("Flameshot won the Gyazo alternative challenge");
  });
});
