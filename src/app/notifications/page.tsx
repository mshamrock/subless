import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MessageSquare, Reply } from "lucide-react";
import { auth } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { subjectHref } from "@/lib/comments";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "@/components/mark-all-read";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const COPY = {
  reply: { icon: Reply, verb: "replied to your comment on" },
  comment_on_project: { icon: MessageSquare, verb: "commented on your project" },
} as const;

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/notifications");

  const items = await getNotifications(session.user.id);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {unread > 0 ? `${unread} unread` : "You are all caught up."}
          </p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          hint="When someone replies to your comment, or comments on a project you submitted, it shows up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const copy = COPY[n.type as keyof typeof COPY] ?? COPY.reply;
            const Icon = copy.icon;
            const actor = n.actorName ?? n.actorLogin ?? "Someone";
            const href = `${subjectHref(n.subjectType, n.subjectSlug)}#comment-${n.commentId}`;

            return (
              <Link
                key={n.id}
                href={href}
                className="card card-hover flex items-start gap-3 p-4"
                style={
                  n.readAt
                    ? undefined
                    : { borderColor: "color-mix(in oklab, var(--color-acid) 32%, transparent)" }
                }
              >
                <Avatar src={n.actorImage} name={actor} size={32} />

                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-semibold">{actor}</span>{" "}
                    <span className="text-[var(--color-muted)]">{copy.verb}</span>{" "}
                    <span className="font-medium">{n.subjectTitle}</span>
                  </p>

                  {n.excerpt && !n.excerptDeletedAt && (
                    <p className="mt-1 line-clamp-2 border-l-2 border-[var(--color-border-strong)] pl-2.5 text-sm text-[var(--color-muted)]">
                      {n.excerpt}
                    </p>
                  )}

                  <p className="mono mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-faint)]">
                    <Icon size={11} />
                    {formatDate(n.createdAt)}
                  </p>
                </div>

                {!n.readAt && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-acid)]" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
