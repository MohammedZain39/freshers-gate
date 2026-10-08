import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import AdminShell from "@/components/admin/AdminShell";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/login");
  }

  // Scanner accounts are restricted to the gate.
  // The /gate page itself is handled separately and does not
  // use the admin shell.
  if (admin.role === "SCANNER") {
    redirect("/gate");
  }

  return <AdminShell admin={admin}>{children}</AdminShell>;
}