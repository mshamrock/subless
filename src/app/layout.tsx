import type { Metadata } from "next";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { auth } from "@/lib/auth";
import { AuthPromptProvider } from "@/components/auth-prompt";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.sentence,
  alternates: {
    types: {
      "application/rss+xml": [{ url: `${BRAND.url}/feed.xml`, title: `${BRAND.name} challenges` }],
    },
  },
  // Search Console's URL-prefix verification. A DNS-verified domain property is
  // the better claim — it covers every subdomain and both schemes, and cannot be
  // lost to a deploy that drops a tag — but this costs nothing, works when DNS is
  // somebody else's to change, and emits nothing at all while the variable is unset
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.short,
    url: BRAND.url,
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: BRAND.name, description: BRAND.short },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once here rather than threading a `signedIn` prop through every page
  // into every button that happens to need an account
  const session = await auth();

  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthPromptProvider signedIn={Boolean(session?.user)}>
          <SiteHeader />
          <main className="mx-auto max-w-6xl px-4 py-10">{children}</main>
          <SiteFooter />
        </AuthPromptProvider>
      </body>
    </html>
  );
}
