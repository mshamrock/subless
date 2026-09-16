"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { submitEntry } from "@/lib/actions/contests";
import { ActionMessage } from "./form-status";
import type { ActionResult } from "@/lib/actions/guard";

export function EntrySubmitForm({
  contestId,
  challengeSlug,
  projects,
}: {
  contestId: number;
  challengeSlug: string;
  projects: { id: number; name: string; slug: string; status: string }[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);
  const [projectId, setProjectId] = useState<string>("");
  const [note, setNote] = useState("");

  if (projects.length === 0) {
    return (
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <p className="text-sm text-[var(--color-muted)]">
          To take part, publish your build first — then enter it here.
        </p>
        <Link href={`/submit?challenge=${challengeSlug}`} className="btn-primary">
          Publish a build
        </Link>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="eyebrow">Join this challenge</h2>
      <ActionMessage state={state} />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_1fr_auto] sm:items-end">
        <div>
          <label className="label" htmlFor="entry-project">Your build</label>
          <select
            id="entry-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="input"
          >
            <option value="">choose…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status !== "approved" ? " (in review)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="entry-note">Note about your entry</label>
          <input
            id="entry-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What you got done this week"
            className="input"
          />
        </div>

        <button
          type="button"
          disabled={pending || !projectId}
          onClick={() =>
            start(async () => {
              const res = await submitEntry(contestId, Number(projectId), note);
              setState(res);
              if (res.ok) {
                setProjectId("");
                setNote("");
              }
            })
          }
          className="btn-primary h-[38px]"
        >
          {pending ? "Submitting…" : "Enter"}
        </button>
      </div>

      <p className="text-xs text-[var(--color-faint)]">
        You can enter a project that is still in review — it shows up in the list once approved.
      </p>
    </div>
  );
}
