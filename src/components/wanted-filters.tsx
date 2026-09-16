"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Matches the `gap-1.5` on the chip row. */
const CHIP_GAP = 6;

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
  const [showAllCategories, setShowAllCategories] = useState(false);

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

  // How many chips fit on one line is a question about pixels, not about a
  // number picked in advance: the names differ in length and the viewport
  // differs per person, so the row measures itself and keeps exactly one line
  const rowRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[] | null>(null);
  const [fitCount, setFitCount] = useState<number | null>(null);

  const selectedIndex = current.category
    ? categories.findIndex((c) => c.slug === current.category)
    : -1;

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;

    // Widths are read once, while every chip is still mounted. They do not
    // change with the viewport, so a resize only re-runs the arithmetic
    if (!widthsRef.current) {
      widthsRef.current = Array.from(row.children).map(
        (child) => (child as HTMLElement).getBoundingClientRect().width,
      );
    }
    const widths = widthsRef.current;
    if (widths.length < 2) return;

    const available = row.clientWidth;
    const allChip = widths[0];
    const toggle = widths[widths.length - 1];

    // The selected chip is never dropped, so its width is spoken for upfront
    const selectedFixed =
      selectedIndex >= 0 ? widths[selectedIndex + 1] + CHIP_GAP : 0;

    let used = allChip + CHIP_GAP + toggle + selectedFixed;
    let fits = 0;
    for (let i = 0; i < categories.length; i++) {
      if (i === selectedIndex) continue;
      const width = widths[i + 1] + CHIP_GAP;
      if (used + width > available) break;
      used += width;
      fits++;
    }
    setFitCount(fits);
  }, [categories.length, selectedIndex]);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);

  // Until the row has measured itself every chip is rendered, which is both how
  // the widths get read and what someone without JavaScript ends up seeing
  const visibleCategories =
    showAllCategories || fitCount === null
      ? categories
      : categories.filter((c, i) => {
          if (i === selectedIndex) return true;
          const before = selectedIndex >= 0 && selectedIndex < i ? 1 : 0;
          return i - before < fitCount;
        });

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
        <div ref={rowRef} className="flex flex-wrap gap-1.5">
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

          {visibleCategories.map((c) => (
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

          {/* Always present for the measuring pass — its width is what the
              arithmetic reserves, so it cannot be missing while widths are read */}
          {(fitCount === null ||
            showAllCategories ||
            visibleCategories.length < categories.length) && (
            <button
              type="button"
              onClick={() => setShowAllCategories((v) => !v)}
              aria-expanded={showAllCategories}
              className="chip text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              {showAllCategories ? "Show fewer" : `Show all ${categories.length}`}
              <ChevronDown
                size={13}
                className={cn("transition-transform", showAllCategories && "rotate-180")}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
