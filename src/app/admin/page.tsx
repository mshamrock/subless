import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { getAdminData, getManagedContent, getSeoAudit } from "@/lib/actions/admin";
import { getWeeklyState } from "@/lib/cycle";
import { AdminPanel } from "@/components/admin-panel";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin?callbackUrl=/admin");
  if (!session.user.isAdmin) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Add your GitHub login to the ADMIN_LOGINS environment variable and sign in again.
        </p>
      </div>
    );
  }

  const [data, state, managed, seo] = await Promise.all([
    getAdminData(),
    getWeeklyState(),
    getManagedContent(),
    getSeoAudit(),
  ]);
  return <AdminPanel data={data} state={state} managed={managed} seo={seo} />;
}
