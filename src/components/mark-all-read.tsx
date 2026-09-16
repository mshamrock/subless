"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { markNotificationsRead } from "@/lib/actions/comments";

export function MarkAllRead() {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => { await markNotificationsRead(); })}
      className="btn-ghost"
    >
      <CheckCheck size={15} />
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
