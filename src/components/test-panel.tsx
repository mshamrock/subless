"use client";

import { useState, useTransition } from "react";
import { Check, ClipboardCheck, Minus, X } from "lucide-react";
import { submitTestReport } from "@/lib/actions/testing";
import { Avatar } from "./avatar";
import { cn, formatDate, plural } from "@/lib/utils";
import { useAuthPrompt } from "./auth-prompt";
import type { TestSummary } from "@/lib/queries";

export function TestPanel({
  entryId,
  requirements,
  summary,
  mine,
  canTest,
  isOwn,
  signedIn,
}: {
  entryId: number;
  requirements: string[];
  summary: TestSummary;
  mine: { items: { requirement: string; met: boolean }[]; note: string | null } | null;
  canTest: boolean;
  isOwn: boolean;
  signedIn: boolean;
}) {
  const { requireAuth } = useAuthPrompt();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [met, setMet] = useState<boolean[]>(() =>
    requirements.map((r) => mine?.items.find((i) => i.requirement === r)?.met ?? false),
  );
  const [note, setNote] = useState(mine?.note ?? "");

  if (requirements.length === 0) return null;

  const verified = summary.coverage.filter((c) => c >= 0.5).length;

  return (
    <div className="mt-3 border-t border-[var(--color-border)] pt-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="mono flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <ClipboardCheck size={13} />
          {summary.testers === 0 ? (
            "not tested yet"
          ) : (
            <>
              {verified}/{requirements.length} verified ·{" "}
              {summary.testers} {plural(summary.testers, "tester", "testers")}
            </>
          )}
        </span>

        {/* Coverage as a strip of bars rather than a number: which requirement is
            failing matters more than the average of all of them */}
        {summary.testers > 0 && (
          <span className="flex gap-[3px]" aria-hidden="true">
            {summary.coverage.map((c, i) => (
              <span
                key={i}
                title={`${requirements[i]} — ${Math.round(c * 100)}% of testers say met`}
                className="h-1.5 w-5 rounded-full"
                style={{
                  background:
                    c >= 0.5 ? "var(--color-acid)" : c > 0 ? "var(--color-voting)" : "var(--color-border-strong)",
                  opacity: c === 0 ? 0.6 : 0.45 + c * 0.55,
                }}
              />
            ))}
          </span>
        )}

        {/* Offered signed out too: the invitation is the point, and the dialog
            asks for the account at the moment it is actually needed */}
        {!isOwn && (
          <button
            type="button"
            onClick={() => {
              if (!signedIn) {
                requireAuth("report what this build does");
                return;
              }
              setOpen((v) => !v);
            }}
            className="mono ml-auto text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            {open ? "close" : mine ? "edit your report" : "test this build"}
          </button>
        )}
        {isOwn && (
          <span className="mono ml-auto text-xs text-[var(--color-faint)]">your build</span>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
          <p className="mb-3 text-xs text-[var(--color-faint)]">
            Try it, then mark what it actually does. This is what the challenge asked for.
          </p>

          <ul className="space-y-1.5">
            {requirements.map((req, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setMet((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                    met[i]
                      ? "bg-[var(--color-acid)]/10 text-[var(--color-fg)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border",
                      met[i]
                        ? "border-[var(--color-acid)] bg-[var(--color-acid)] text-[#0a0b0d]"
                        : "border-[var(--color-border-strong)]",
                    )}
                  >
                    {met[i] ? <Check size={11} strokeWidth={3} /> : <Minus size={10} />}
                  </span>
                  {req}
                </button>
              </li>
            ))}
          </ul>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="What broke, what was missing, what would make it a real replacement"
            className="input mt-3 resize-y text-sm"
          />

          {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !canTest}
              title={canTest ? undefined : "Testing is closed for this challenge"}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await submitTestReport(entryId, met, note);
                  if (res.ok) setOpen(false);
                  else setError(res.error);
                })
              }
              className="btn-primary px-3 py-1.5 text-xs"
            >
              {pending ? "Saving…" : mine ? "Update report" : "Submit report"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {summary.reports.some((r) => r.note) && (
        <ul className="mt-3 space-y-2">
          {summary.reports
            .filter((r) => r.note)
            .slice(0, 3)
            .map((r) => (
              <li key={r.id} className="flex gap-2.5 text-xs">
                <Avatar
                  src={r.authorImage}
                  name={r.authorName ?? r.authorLogin ?? "?"}
                  size={20}
                />
                <div className="min-w-0">
                  <p className="mono text-[var(--color-faint)]">
                    {r.authorLogin ? `@${r.authorLogin}` : "someone"} · {r.metCount}/{r.total} met ·{" "}
                    {formatDate(r.createdAt)}
                  </p>
                  <p className="mt-0.5 text-[var(--color-muted)]">{r.note}</p>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
