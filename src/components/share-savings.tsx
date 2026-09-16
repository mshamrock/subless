"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { formatMoneyCompact } from "@/lib/utils";

/**
 * Shareable proof (§14). Copy to clipboard rather than a social intent URL: it
 * works on every platform, needs no third-party script, and does not ship a
 * tracking pixel from a site that sells itself on not tracking people.
 *
 * Clipboard access is denied often enough — insecure origins, embedded
 * browsers, tightened permissions — that a silent failure would strand people at
 * exactly the moment they wanted to tell someone. On failure the text is shown
 * instead, pre-selected, so copying by hand is one keystroke.
 */
export function ShareSavings({ annual, names }: { annual: number; names: string[] }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");

  const listed = names.slice(0, 3).join(", ");
  const rest = names.length > 3 ? ` and ${names.length - 3} more` : "";
  const text =
    `I went Subless on ${listed}${rest}.\n` +
    `${formatMoneyCompact(annual)}/year I no longer pay for software.\n\n` +
    `${BRAND.tagline} ${BRAND.url}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setState("copied");
              setTimeout(() => setState("idle"), 2000);
            } catch {
              setState("manual");
            }
          }}
          className="btn-primary"
        >
          {state === "copied" ? <Check size={16} /> : <Share2 size={16} />}
          {state === "copied" ? "Copied" : "Share my savings"}
        </button>

        <p className="mono text-xs text-[var(--color-faint)]">
          {state === "manual" ? "clipboard blocked — copy it below" : "copies a short summary"}
        </p>
      </div>

      {state === "manual" && (
        <textarea
          readOnly
          rows={4}
          value={text}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className="input resize-none font-mono text-xs"
        />
      )}
    </div>
  );
}
