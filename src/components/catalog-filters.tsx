"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const SORTS = [
  { value: "score", label: "Top rated" },
  { value: "stars", label: "Most stars" },
  { value: "new", label: "Newest" },
  { value: "alpha", label: "A–Z" },
] as const;

export function CatalogFiltersBar({
  categories,
  current,
}: {
  categories: { id: number; slug: string; name: string; emoji: string | null; targetCount: number }[];
  current: { q: string; category: string; sort: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q);

  // Searching on every keystroke would hammer the server; waiting for a submit
  // feels clunky. 350ms stays out of the way without firing a query per letter
  useEffect(() => {
    if (q === current.q) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      router.replace(`/catalog?${next.toString()}`);
    }, 350);
    return () => clearTimeout(timer);
  }, [q, current.q, router, searchParams]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/catalog?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Gyazo, Miro, Notion…"
          className="input py-2.5 pl-9"
          aria-label="Search the catalog"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setParam("category", "")}
          className={cn("chip", !current.category && "border-[var(--color-acid-dim)] text-[var(--color-acid)]")}
        >
          all
        </button>
        {categories
          .filter((c) => c.targetCount > 0)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setParam("category", c.slug === current.category ? "" : c.slug)}
              className={cn(
                "chip",
                current.category === c.slug && "border-[var(--color-acid-dim)] text-[var(--color-acid)]",
              )}
            >
              {c.emoji} {c.name}
            </button>
          ))}

        <div className="ml-auto">
          <select
            value={current.sort}
            onChange={(e) => setParam("sort", e.target.value)}
            aria-label="Sort order"
            className="input w-auto py-1.5 text-xs"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
