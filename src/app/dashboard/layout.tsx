import { redirect } from "next/navigation";
import { hasRole } from "@/lib/rbac";
import { getAdminSession } from "@/lib/admin/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  if (!hasRole(session.role, ["admin", "manager"])) {
    redirect("/unauthorized");
  }

  return <AdminShell>{children}</AdminShell>;
}
