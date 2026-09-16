"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { BadgeCheck, CircleAlert, Check, Plus } from "lucide-react";
import { submitProject, type SubmittedProject } from "@/lib/actions/projects";
import { ActionMessage } from "./form-status";
import type { ActionResult } from "@/lib/actions/guard";

export function SubmitProjectForm({
  targets,
  challengeSlug,
  challengeTitle,
}: {
  targets: { id: number; name: string; slug: string }[];
  challengeSlug?: string;
  challengeTitle?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<SubmittedProject> | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedProject | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [showNewTarget, setShowNewTarget] = useState(false);
  const [filter, setFilter] = useState("");

  const visible = filter.trim()
    ? targets.filter((t) => t.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : targets;

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /**
   * Submitting through onSubmit rather than <form action> on purpose: React 19
   * wipes an uncontrolled form once a form action resolves. On a validation error
   * that threw away everything the person had typed, and on success it left a
   * blank form that read as "nothing happened" — so people submitted again and
   * hit the duplicate-repository check.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    for (const id of selected) formData.append("targetIds", String(id));
    if (challengeSlug) formData.append("challengeSlug", challengeSlug);

    start(async () => {
      const res = await submitProject(null, formData);
      setResult(res);
      if (res.ok && res.data) setSubmitted(res.data);
    });
  }

  if (submitted) {
    return <SubmittedPanel project={submitted} onAddAnother={() => {
      setSubmitted(null);
      setResult(null);
      setSelected([]);
      setFilter("");
      setShowNewTarget(false);
    }} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <ActionMessage state={result} />

      <div className="card space-y-4 p-6">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required placeholder="Snimok" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="tagline">One-line description</label>
          <input
            id="tagline"
            name="tagline"
            required
            maxLength={160}
            placeholder="Screenshots with the link already in your clipboard"
            className="input"
          />
        </div>

        <div>
          <label className="label" htmlFor="repoUrl">Repository URL</label>
          <input
            id="repoUrl"
            name="repoUrl"
            required
            placeholder="https://github.com/user/snimok"
            className="input"
          />
          <p className="mt-1.5 text-xs text-[var(--color-faint)]">
            We check through GitHub that you have write access to this repository. If the check
            passes, the card gets a verified author badge.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="homepageUrl">
            Live demo <span className="text-[var(--color-faint)]">(optional)</span>
          </label>
          <input id="homepageUrl" name="homepageUrl" type="url" placeholder="https://snimok.app" className="input" />
          <p className="mt-1.5 text-xs text-[var(--color-faint)]">
            Leave blank and we take whatever your repository declares as its homepage.
            A live site gets a Try button on every card.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="builtWith">
            Built with <span className="text-[var(--color-faint)]">(optional)</span>
          </label>
          <input id="builtWith" name="builtWith" placeholder="Claude Code" className="input" />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Full description <span className="text-[var(--color-faint)]">(optional)</span>
          </label>
          <textarea id="description" name="description" rows={5} className="input resize-y" />
        </div>
      </div>

      <div className="card space-y-4 p-6">
        <div>
          <h2 className="label mb-1">Which subscription does this replace?</h2>
          <p className="text-xs text-[var(--color-faint)]">
            This is the field everything turns on — it is how people find you, and how the
            savings get counted. Pick as many as apply.
          </p>
        </div>

        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a subscription…"
          className="input"
          aria-label="Search subscriptions"
        />

        <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="text-sm text-[var(--color-faint)]">No matches</p>
          ) : (
            visible.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={`chip ${
                  selected.includes(t.id)
                    ? "border-[var(--color-acid-dim)] text-[var(--color-acid)]"
                    : "hover:border-[var(--color-border-strong)]"
                }`}
              >
                {selected.includes(t.id) && <Check size={12} />}
                {t.name}
              </button>
            ))
          )}
        </div>

        {selected.length > 0 && (
          <p className="mono text-xs text-[var(--color-acid-dim)]">
            selected: {selected.length}
          </p>
        )}

        <button
          type="button"
          onClick={() => setShowNewTarget((v) => !v)}
          className="text-sm text-[var(--color-muted)] underline-offset-4 hover:text-[var(--color-fg)] hover:underline"
        >
          {showNewTarget ? "− Hide" : "+ The subscription I need is not listed"}
        </button>

        {showNewTarget && (
          <div className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="newTargetName">Subscription name</label>
              <input id="newTargetName" name="newTargetName" placeholder="Gyazo" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="newTargetUrl">Its website</label>
              <input id="newTargetUrl" name="newTargetUrl" placeholder="https://gyazo.com" className="input" />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending
            ? "Checking the repository…"
            : challengeTitle
              ? "Publish and enter the challenge"
              : "Publish build"}
        </button>
        <p className="text-xs text-[var(--color-faint)]">GitHub metrics are pulled automatically</p>
      </div>
    </form>
  );
}

/** Replaces the form entirely on success — a blank form is not a confirmation. */
function SubmittedPanel({
  project,
  onAddAnother,
}: {
  project: SubmittedProject;
  onAddAnother: () => void;
}) {
  return (
    <div
      className="card p-8"
      style={{ borderColor: "color-mix(in oklab, var(--color-acid) 40%, transparent)" }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-acid)] text-[#0a0b0d]">
          <Check size={22} strokeWidth={3} />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{project.name} is published</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {project.enteredChallenge
              ? `Entered into ${project.enteredChallenge}. Waiting for an admin to review it.`
              : "Waiting for an admin to review it."}
          </p>
        </div>
      </div>

      <div
        className="mt-6 flex items-start gap-2.5 rounded-lg border p-3.5 text-sm"
        style={{
          borderColor: project.ownershipVerified
            ? "color-mix(in oklab, var(--color-acid) 35%, transparent)"
            : "color-mix(in oklab, var(--color-voting) 35%, transparent)",
        }}
      >
        {project.ownershipVerified ? (
          <>
            <BadgeCheck size={17} className="mt-px shrink-0 text-[var(--color-acid)]" />
            <span>
              Repository ownership confirmed through GitHub — the card will carry a
              verified author badge.
            </span>
          </>
        ) : (
          <>
            <CircleAlert size={17} className="mt-px shrink-0 text-[var(--color-voting)]" />
            <span>
              We could not confirm you have write access to this repository. That does not
              block publication, but the card will not get a verified author badge.
            </span>
          </>
        )}
      </div>

      <ol className="mt-6 space-y-2.5 text-sm text-[var(--color-muted)]">
        <li className="flex gap-3">
          <span className="mono shrink-0 text-[var(--color-acid-dim)]">01</span>
          GitHub metrics have already been pulled, so the project reaches review with real numbers.
        </li>
        <li className="flex gap-3">
          <span className="mono shrink-0 text-[var(--color-acid-dim)]">02</span>
          Once approved it joins the community alternatives and starts collecting a score.
        </li>
        <li className="flex gap-3">
          <span className="mono shrink-0 text-[var(--color-acid-dim)]">03</span>
          {project.enteredChallenge
            ? "It is already in the challenge — approval is not required to compete."
            : "You can enter it into the current challenge right away — approval is not required to compete."}
        </li>
      </ol>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href={`/projects/${project.slug}`} className="btn-primary">
          View the project page
        </Link>
        <Link href="/challenges" className="btn-ghost">
          Join a challenge
        </Link>
        <button type="button" onClick={onAddAnother} className="btn-ghost">
          <Plus size={15} /> Submit another
        </button>
      </div>
    </div>
  );
}
