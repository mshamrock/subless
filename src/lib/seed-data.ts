import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, projectTargets, projects, targets } from "@/lib/db/schema";
import { parseRepoUrl } from "@/lib/github";
import { ensureTargetIcon } from "@/lib/targets";
import { syncProject } from "@/lib/sync";
import { slugify } from "@/lib/utils";

/**
 * Reference data: verifiable facts only.
 *
 * Everything here is checkable — real categories, real paid services with their
 * real prices, and real open-source projects with real repositories. No invented
 * people, no invented votes, and above all no invented savings: the North Star
 * is the one number the whole brand rests on, and seeding it with fiction would
 * make the site's central claim a lie on its first day.
 *
 * Every step is idempotent. This runs against a live database, and a second run
 * must not duplicate rows or overwrite what the community has since added.
 */

const CATEGORIES = [
  { slug: "screenshots", name: "Screenshots & recording", emoji: "📸" },
  { slug: "whiteboard", name: "Whiteboards & diagrams", emoji: "🎨" },
  { slug: "docs", name: "Docs & notes", emoji: "📝" },
  { slug: "database", name: "Databases & sheets", emoji: "🗂" },
  { slug: "automation", name: "Automation", emoji: "⚡️" },
  { slug: "scheduling", name: "Calendars & meetings", emoji: "📅" },
  { slug: "analytics", name: "Analytics", emoji: "📊" },
  { slug: "email", name: "Email & newsletters", emoji: "✉️" },
  { slug: "hosting", name: "Hosting & deploys", emoji: "🚀" },
  { slug: "design", name: "Design", emoji: "✏️" },
  { slug: "files", name: "Files & PDFs", emoji: "📁" },
  { slug: "transcription", name: "Audio & transcription", emoji: "🎙" },
  { slug: "video", name: "Video & motion", emoji: "🎬" },
];

const TARGETS = [
  { slug: "gyazo", name: "Gyazo", website: "https://gyazo.com", price: 4.99, category: "screenshots", description: "One-click screenshots with the share link landing straight in your clipboard." },
  { slug: "loom", name: "Loom", website: "https://loom.com", price: 15, category: "screenshots", description: "Screen recording with webcam and transcripts, shareable the moment you stop." },
  { slug: "miro", name: "Miro", website: "https://miro.com", price: 16, category: "whiteboard", description: "An infinite collaborative whiteboard: sticky notes, diagrams, workshops." },
  { slug: "notion", name: "Notion", website: "https://notion.so", price: 10, category: "docs", description: "Knowledge base, documents and databases in one workspace." },
  { slug: "airtable", name: "Airtable", website: "https://airtable.com", price: 20, category: "database", description: "A spreadsheet that behaves like a database, with forms and custom views." },
  { slug: "zapier", name: "Zapier", website: "https://zapier.com", price: 29.99, category: "automation", description: "Wires services together without code on a plain if-this-then-that model." },
  { slug: "calendly", name: "Calendly", website: "https://calendly.com", price: 12, category: "scheduling", description: "A booking link that checks your calendar for you before offering slots." },
  { slug: "google-analytics", name: "Google Analytics", website: "https://analytics.google.com", price: 0, category: "analytics", description: "Web analytics that costs nothing in money and plenty in privacy." },
  { slug: "mailchimp", name: "Mailchimp", website: "https://mailchimp.com", price: 20, category: "email", description: "Mailing lists, campaigns and marketing automation." },
  { slug: "vercel", name: "Vercel", website: "https://vercel.com", price: 20, category: "hosting", description: "Push-to-deploy hosting for frontend apps." },
  { slug: "figma", name: "Figma", website: "https://figma.com", price: 15, category: "design", description: "Collaborative interface design in the browser." },
  { slug: "typeform", name: "Typeform", website: "https://typeform.com", price: 25, category: "docs", description: "Surveys and forms with a pleasant one-question-at-a-time flow." },
  { slug: "linear", name: "Linear", website: "https://linear.app", price: 8, category: "docs", description: "Issue tracking built around speed and keyboard navigation." },
  { slug: "retool", name: "Retool", website: "https://retool.com", price: 10, category: "database", description: "Internal admin panels assembled from blocks over your own database." },

  // The desktop suites ArtCraft rebuilt with agents in autumn 2026. Prices are
  // the single-app plan, annual commitment billed monthly — the plan someone
  // replacing one app actually cancels. Microsoft 365 is one service, not three:
  // nobody pays for Word separately, and three rows would let one cancelled
  // subscription count three times toward what the community has replaced.
  // Adobe's apps carry an explicit icon: they share adobe.com, so fetched by
  // domain they would all show the same red "A". Commons serves a PNG render
  // at the requested width, so no SVG is ever stored or served from our domain
  { slug: "photoshop", name: "Photoshop", website: "https://www.adobe.com/products/photoshop.html", price: 22.99, category: "design", description: "Raster image editing: layers, masks, brushes, and the PSD format everyone else has to open.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Photoshop_CC_icon.svg?width=128" },
  { slug: "lightroom", name: "Lightroom", website: "https://www.adobe.com/products/photoshop-lightroom.html", price: 11.99, category: "design", description: "Non-destructive photo development and a library to keep the photos in.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Photoshop_Lightroom_CC_logo.svg?width=128" },
  { slug: "illustrator", name: "Illustrator", website: "https://www.adobe.com/products/illustrator.html", price: 22.99, category: "design", description: "Vector illustration: paths, type and artboards that print and scale cleanly.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Illustrator_CC_icon.svg?width=128" },
  { slug: "indesign", name: "InDesign", website: "https://www.adobe.com/products/indesign.html", price: 22.99, category: "design", description: "Page layout for print and digital publishing.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Indesign_CC_2026_icon.svg?width=128" },
  { slug: "premiere-pro", name: "Premiere Pro", website: "https://www.adobe.com/products/premiere.html", price: 22.99, category: "video", description: "Timeline video editing with colour, audio and export to every format a client asks for.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Premiere_Pro_CC_Icon.png?width=128" },
  { slug: "after-effects", name: "After Effects", website: "https://www.adobe.com/products/aftereffects.html", price: 22.99, category: "video", description: "Motion graphics and compositing, keyframe by keyframe.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_After_Effects_CC_icon.svg?width=128" },
  { slug: "acrobat-pro", name: "Acrobat Pro", website: "https://www.adobe.com/acrobat/acrobat-pro.html", price: 19.99, category: "files", description: "Reading, editing, signing and protecting PDFs.", icon: "https://commons.wikimedia.org/wiki/Special:FilePath/Adobe_Acrobat_DC_logo_2020.svg?width=128" },
  { slug: "microsoft-365", name: "Microsoft 365", website: "https://www.microsoft.com/microsoft-365", price: 9.99, category: "docs", description: "Word, Excel and PowerPoint — the documents, spreadsheets and decks everyone else expects to receive." },
  { slug: "autocad", name: "AutoCAD", website: "https://www.autodesk.com/products/autocad", price: 169.17, category: "design", description: "Computer-aided drafting and design, and the DWG format the trade runs on." },
  { slug: "pro-tools", name: "Pro Tools", website: "https://www.avid.com/pro-tools", price: 9.99, category: "transcription", description: "Recording, editing and mixing audio — the studio standard." },
];

/** Catalogued alternatives. Real projects, real repositories, no claimed author. */
const PROJECTS = [
  { name: "Flameshot", repo: "flameshot-org/flameshot", targets: ["gyazo"], tagline: "Annotated screenshots with instant upload, entirely free" },
  { name: "ShareX", repo: "ShareX/ShareX", targets: ["gyazo", "loom"], tagline: "Screenshots, screen recording and upload anywhere, endlessly configurable" },
  { name: "Cap", repo: "CapSoftware/Cap", targets: ["loom"], tagline: "Screen recording with a shareable link the moment you stop, open source" },
  { name: "Excalidraw", repo: "excalidraw/excalidraw", targets: ["miro"], tagline: "A whiteboard with hand-drawn diagrams and live collaboration" },
  { name: "tldraw", repo: "tldraw/tldraw", targets: ["miro", "figma"], tagline: "An infinite canvas you can embed inside your own app" },
  { name: "AppFlowy", repo: "AppFlowy-IO/AppFlowy", targets: ["notion"], tagline: "Notes, databases and kanban boards running locally on your machine" },
  { name: "Outline", repo: "outline/outline", targets: ["notion"], tagline: "A team knowledge base with fast search and real permissions" },
  { name: "NocoDB", repo: "nocodb/nocodb", targets: ["airtable"], tagline: "Turns any SQL database into a spreadsheet with forms and views" },
  { name: "n8n", repo: "n8n-io/n8n", targets: ["zapier"], tagline: "Visual automation with real code where you need it, on your own server" },
  { name: "Activepieces", repo: "activepieces/activepieces", targets: ["zapier"], tagline: "Automation with AI agents and an open catalog of integrations" },
  { name: "Cal.com", repo: "calcom/cal.com", targets: ["calendly"], tagline: "Meeting scheduling you can self-host and embed anywhere" },
  { name: "Plausible", repo: "plausible/analytics", targets: ["google-analytics"], tagline: "Lightweight web analytics with no cookies and no personal data" },
  { name: "Umami", repo: "umami-software/umami", targets: ["google-analytics"], tagline: "Self-hosted analytics: one script, zero tracking" },
  { name: "Listmonk", repo: "knadh/listmonk", targets: ["mailchimp"], tagline: "Newsletters to millions of subscribers from a single binary" },
  { name: "Coolify", repo: "coollabsio/coolify", targets: ["vercel"], tagline: "Git-push deploys onto your own server, like the big platforms" },
  { name: "Penpot", repo: "penpot/penpot", targets: ["figma"], tagline: "An interface design editor built on web standards, open and self-hostable" },
  { name: "OpnForm", repo: "JhumanJ/OpnForm", targets: ["typeform"], tagline: "Good-looking forms and surveys without a subscription" },

  // ArtCraft's Crafting Apps. Each is a clean-room reimplementation in Rust,
  // Apache-2.0, published from late September 2026 — and the agent claim is
  // checkable rather than reported: a large share of every repository's recent
  // commits carry "Co-Authored-By: Claude Opus 5.5". The taglines say alpha
  // because the project says alpha; its own parity estimates run 25–65%
  { name: "PhotoCraft", repo: "storytold/photocraft", targets: ["photoshop"], builtWith: "Claude Opus 5.5", tagline: "A clean-room Photoshop in Rust: layers, masks, PSD files — early alpha" },
  { name: "LightCraft", repo: "storytold/lightcraft", targets: ["lightroom"], builtWith: "Claude Opus 5.5", tagline: "Non-destructive photo development in Rust, Lightroom-style — early alpha" },
  { name: "VectorCraft", repo: "storytold/vectorcraft", targets: ["illustrator"], builtWith: "Claude Opus 5.5", tagline: "Vector illustration in Rust, in Illustrator's image — early alpha" },
  { name: "DesignCraft", repo: "storytold/designcraft", targets: ["indesign"], builtWith: "Claude Opus 5.5", tagline: "Page layout and publishing in Rust, InDesign-style — early alpha" },
  { name: "FilmCraft", repo: "storytold/filmcraft", targets: ["premiere-pro"], builtWith: "Claude Opus 5.5", tagline: "A nonlinear video editor in Rust, modelled on Premiere Pro — alpha" },
  { name: "EffectCraft", repo: "storytold/effectcraft", targets: ["after-effects"], builtWith: "Claude Opus 5.5", tagline: "Motion graphics and compositing in Rust, After Effects-style — early alpha" },
  { name: "PdfCraft", repo: "storytold/pdfcraft", targets: ["acrobat-pro"], builtWith: "Claude Opus 5.5", tagline: "Read, edit and protect PDFs without Acrobat — early alpha" },
  { name: "WordCraft", repo: "storytold/wordcraft", targets: ["microsoft-365"], builtWith: "Claude Opus 5.5", tagline: "A clean-room Microsoft Word in Rust that reads and writes .docx — alpha" },
  { name: "GridCraft", repo: "storytold/gridcraft", targets: ["microsoft-365"], builtWith: "Claude Opus 5.5", tagline: "An Excel-style spreadsheet in Rust with hundreds of functions — pre-alpha" },
  { name: "DeckCraft", repo: "storytold/deckcraft", targets: ["microsoft-365"], builtWith: "Claude Opus 5.5", tagline: "Presentations in Rust, modelled on PowerPoint — pre-alpha" },
  { name: "CADCraft", repo: "storytold/cadcraft", targets: ["autocad"], builtWith: "Claude Opus 5.5", tagline: "Computer-aided drafting in Rust, AutoCAD-style — early development" },
  { name: "SoundCraft", repo: "storytold/soundcraft", targets: ["pro-tools"], builtWith: "Claude Opus 5.5", tagline: "Recording and mixing in Rust, modelled on Pro Tools — pre-alpha" },
  { name: "FigCraft", repo: "storytold/figcraft", targets: ["figma"], builtWith: "Claude Opus 5.5", tagline: "Interface design and prototyping in Rust, Figma-style — just started" },
];

export interface SeedResult {
  categories: number;
  services: number;
  alternatives: number;
  skipped: number;
}

export async function seedReferenceData(
  options: { targetsOnly?: boolean; onProgress?: (line: string) => void } = {},
): Promise<SeedResult> {
  const log = options.onProgress ?? (() => {});
  const result: SeedResult = { categories: 0, services: 0, alternatives: 0, skipped: 0 };

  const categoryIds = new Map<string, number>();
  for (const c of CATEGORIES) {
    const [existing] = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, c.slug))
      .limit(1);
    if (existing) {
      categoryIds.set(c.slug, existing.id);
      continue;
    }
    const [row] = await db.insert(categories).values(c).returning();
    categoryIds.set(c.slug, row.id);
    result.categories++;
  }

  const targetIds = new Map<string, number>();
  for (const t of TARGETS) {
    const [existing] = await db.select().from(targets).where(eq(targets.slug, t.slug)).limit(1);
    if (existing) {
      targetIds.set(t.slug, existing.id);
      if (!existing.logoData) {
        await ensureTargetIcon(existing.id, existing.slug, existing.websiteUrl, "icon" in t ? t.icon : null);
      }
      continue;
    }
    const [row] = await db
      .insert(targets)
      .values({
        slug: t.slug,
        name: t.name,
        websiteUrl: t.website,
        monthlyPriceUsd: t.price,
        description: t.description,
        categoryId: categoryIds.get(t.category)!,
      })
      .returning();
    targetIds.set(t.slug, row.id);
    await ensureTargetIcon(row.id, row.slug, row.websiteUrl, "icon" in t ? t.icon : null);
    result.services++;
    log(`service: ${t.name}`);
  }

  if (options.targetsOnly) return result;

  for (const p of PROJECTS) {
    const repo = parseRepoUrl(p.repo)!;
    const repoUrl = `https://github.com/${repo.fullName}`;

    const [existing] = await db
      .select()
      .from(projects)
      .where(eq(projects.repoUrl, repoUrl))
      .limit(1);
    if (existing) {
      result.skipped++;
      continue;
    }

    const [row] = await db
      .insert(projects)
      .values({
        slug: slugify(p.name),
        name: p.name,
        tagline: p.tagline,
        repoUrl,
        repoFullName: repo.fullName,
        builtWith: "builtWith" in p ? p.builtWith : null,
        status: "approved",
        approvedAt: new Date(),
        // No submitter: nobody here built these, and attributing them to an
        // account would be a claim the project cannot support
        submittedById: null,
      })
      .returning();

    await db
      .insert(projectTargets)
      .values(p.targets.map((t) => ({ projectId: row.id, targetId: targetIds.get(t)! })));

    await syncProject(row.id).catch(() => null);
    result.alternatives++;
    log(`alternative: ${p.name}`);
  }

  return result;
}
