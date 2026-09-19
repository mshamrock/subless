"use client";

import { useRef, useState, useTransition } from "react";
import { createNomination } from "@/lib/actions/nominations";
import { ActionMessage } from "./form-status";
import type { ActionResult } from "@/lib/actions/guard";

export function NominationForm({ defaultName = "" }: { defaultName?: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Same reason as the submit form: React 19 clears an uncontrolled form once a
  // form action resolves, which wipes the person's text on a validation error.
  // Here we clear it ourselves, and only when the nomination actually went through.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    start(async () => {
      const res = await createNomination(null, formData);
      setResult(res);
      if (res.ok) formRef.current?.reset();
    });
  }

  return (
    // A container query, not a viewport one: this form sits full width at the
    // bottom of a phone and in a 360px column beside the list on a desktop, and
    // what it has to fit is the column, not the screen
    <form ref={formRef} onSubmit={handleSubmit} className="card @container space-y-4 p-6">
      <h2 className="eyebrow">What subscription do you hate paying for?</h2>
      <ActionMessage state={result} />

      <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
        <div>
          <label className="label" htmlFor="targetName">Subscription</label>
          <input
            id="targetName"
            name="targetName"
            required
            placeholder="Miro"
            // Keyed on the search term so a new query refills the field rather
            // than leaving whatever React rendered the first time
            key={defaultName}
            defaultValue={defaultName}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="targetUrl">Website</label>
          <input id="targetUrl" name="targetUrl" type="url" placeholder="https://miro.com" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="monthlyPriceUsd">$ per month</label>
          <input
            id="monthlyPriceUsd"
            name="monthlyPriceUsd"
            type="number"
            min="0"
            step="0.01"
            placeholder="16"
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="pitch">What would you actually need instead?</label>
        <textarea
          id="pitch"
          name="pitch"
          required
          rows={3}
          placeholder="The handful of features you actually use — and what the paid product piles on top"
          className="input resize-y"
        />
        <p className="mt-1.5 text-xs text-[var(--color-faint)]">
          The more concrete you are, the better the odds a week produces something usable.
          This text becomes the challenge requirements.
        </p>
      </div>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? "Submitting…" : "I want this replaced"}
      </button>
    </form>
  );
}
