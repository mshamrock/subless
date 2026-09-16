"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NominationCategory {
  slug: string;
  name: string;
  emoji: string | null;
  count: number;
}

/**
 * Search and category live in the URL rather than in component state, so a
 * filtered view is linkable and survives a reload — and the page still renders
 * without JavaScript. 300ms of debounce keeps typing smooth without firing a
 * request per keystroke.
 */
export function WantedFilters({
  categories,
  total,
  current,
}: {
  categories: NominationCategory[];
  /** Real nomination count. Summing the categories under-reports by exactly the
      rows whose service has no category yet, which is a confusing way to lie. */
  total: number;
  current: { q: string; category: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(current.q);

  function push(next: URLSearchParams) {
    const query = next.toString();
    router.replace(query ? `/wanted?${query}` : "/wanted", { scroll: false });
  }

  useEffect(() => {
    if (value === current.q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      push(next);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, current.q]);

  function setCategory(slug: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (slug && slug !== current.category) next.set("category", slug);
    else next.delete("category");
    push(next);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Is your subscription already nominated? Notion, Linear, Figma…"
          aria-label="Search nominated subscriptions"
          className="input py-2.5 pl-9 pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)] hover:text-[var(--color-fg)]"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory("")}
            className={cn(
              "chip",
              !current.category && "border-[var(--color-acid-dim)] text-[var(--color-acid)]",
            )}
          >
            All
            <span className="mono text-[var(--color-faint)]">{total}</span>
          </button>

          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setCategory(c.slug)}
              className={cn(
                "chip",
                current.category === c.slug &&
                  "border-[var(--color-acid-dim)] text-[var(--color-acid)]",
              )}
            >
              {c.emoji} {c.name}
              <span className="mono text-[var(--color-faint)]">{c.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
