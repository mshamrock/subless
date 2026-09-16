"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

/**
 * Search lives in the URL rather than in component state so a result is
 * linkable and survives a reload — and so the page can render without JS.
 * 300ms of debounce keeps typing smooth without a request per keystroke.
 */
export function WantedSearch({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(current);

  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `/wanted?${query}` : "/wanted", { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, current, router, searchParams]);

  return (
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
  );
}
