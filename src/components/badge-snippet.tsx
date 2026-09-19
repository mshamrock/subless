"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * The README badge, ready to paste.
 *
 * Shown to the person who built the thing, because it goes in their
 * repository: the badge is the one part of Subless that lives on someone
 * else's page, and it only gets there if pasting it takes one click.
 */
export function BadgeSnippet({
  imageUrl,
  linkUrl,
  alt,
  note,
}: {
  imageUrl: string;
  linkUrl: string;
  alt: string;
  note: string;
}) {
  const [copied, setCopied] = useState(false);
  const markdown = `[![${alt}](${imageUrl})](${linkUrl})`;

  // The snippet has to carry absolute URLs — it is read on github.com — but the
  // preview beside it is served by whatever host is showing this page, so it
  // still renders on localhost and on a preview deployment
  const preview = imageUrl.startsWith(BRAND.url)
    ? imageUrl.slice(BRAND.url.length)
    : imageUrl;

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused; the markdown below stays selectable
    }
  }

  return (
    <div className="space-y-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preview} alt={alt} height={20} className="block" />

      <div className="flex items-start gap-2">
        {/* w-0 alongside flex-1: without an explicit width the snippet's own
            length becomes the layout's minimum, and one unbreakable line of
            markdown then widens every ancestor up to the page */}
        <code className="mono w-0 min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[11px] text-[var(--color-muted)]">
          {markdown}
        </code>
        <button
          type="button"
          onClick={copy}
          className="btn-ghost shrink-0 px-3 py-2 text-xs"
          aria-label="Copy the markdown"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <p className="text-xs text-[var(--color-faint)]">{note}</p>
    </div>
  );
}
