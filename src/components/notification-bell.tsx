import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadNotificationCount } from "@/lib/queries";

export async function NotificationBell({ userId }: { userId: string }) {
  const unread = await getUnreadNotificationCount(userId);

  return (
    <Link
      href="/notifications"
      title={unread ? `${unread} unread` : "Notifications"}
      className="relative rounded-lg p-2 text-[var(--color-faint)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-fg)]"
    >
      <Bell size={16} />
      {unread > 0 && (
        <span className="mono absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-acid)] px-1 text-[10px] font-bold text-[#0a0b0d]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
