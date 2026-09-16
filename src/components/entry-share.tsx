"use client";

import { useState } from "react";
import { Check, Link2, Share2 } from "lucide-react";
import { BRAND } from "@/lib/brand";

/**
 * The share control on your own entry.
 *
 * The link carries the entry twice — `?entry=12` so the server can build a
 * preview card about this build rather than the challenge, and `#entry-12` so
 * the browser scrolls to it. Fragments never reach a server, query strings
 * never move the viewport; the link needs both to do both jobs.
 */
export function EntryShare({
  entryId,
  challengeSlug,
  projectName,
  targetName,
  yearly,
}: {
  entryId: number;
  challengeSlug: string;
  projectName: string;
  targetName: string | null;
  yearly: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = `${BRAND.url}/challenges/${challengeSlug}?entry=${entryId}#entry-${entryId}`;
  const text = targetName
    ? `I built ${projectName}, a free alternative to ${targetName}${yearly ? ` — ${yearly} you stop paying` : ""}. Vote for it in the Subless challenge:`
    : `I built ${projectName}, a free alternative. Vote for it in the Subless challenge:`;

  const targets = [
    { label: "X", href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}` },
    { label: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text} ${url}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
    { label: "Reddit", href: `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}` },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused outright; the field below is the fallback
      setOpen(true);
    }
  }

  return (
    <div className="relative z-10 mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chip text-[var(--color-muted)] hover:text-[var(--color-fg)]"
      >
        <Share2 size={12} />
        Share for votes
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--color-border)] p-3">
          <p className="text-xs text-[var(--color-muted)]">{text}</p>

          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <a
                key={t.label}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="chip hover:border-[var(--color-acid-dim)] hover:text-[var(--color-acid)]"
              >
                {t.label}
              </a>
            ))}

            <button
              type="button"
              onClick={copy}
              className="chip hover:border-[var(--color-acid-dim)] hover:text-[var(--color-acid)]"
            >
              {copied ? <Check size={12} /> : <Link2 size={12} />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>

          {/* Selectable, so the link is still reachable when the clipboard is not */}
          <p className="mono truncate text-[11px] text-[var(--color-faint)]" title={url}>
            {url}
          </p>
        </div>
      )}
    </div>
  );
}
