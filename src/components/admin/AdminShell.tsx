"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Upload,
  ScanLine,
  ClipboardList,
  Settings,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  CreditCard,
} from "lucide-react";
import { useState } from "react";

type Admin = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function AdminShell({
  admin,
  children,
}: {
  admin: Admin;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Students",
      href: "/students",
      icon: Users,
    },
    {
      name: "Import Students",
      href: "/import",
      icon: Upload,
    },
    {
      name: "Scanner",
      href: "/scanner",
      icon: ScanLine,
    },
    {
      name: "Entry Logs",
      href: "/entry-logs",
      icon: ClipboardList,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
    {
      name: "Digital IDs",
      href: "/digital-ids",
      icon: CreditCard,
    },
  ];

  async function handleLogout() {
    setLoggingOut(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Mobile Header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950">
            <ShieldCheck size={21} />
          </div>

          <div>
            <p className="text-sm font-bold">Freshers Gate</p>
            <p className="text-[10px] text-slate-500">ENTRY SYSTEM</p>
          </div>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800 bg-slate-950 transition-transform duration-200 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-950">
            <ShieldCheck size={23} />
          </div>

          <div>
            <h1 className="text-base font-bold">Freshers Gate</h1>
            <p className="text-[10px] font-medium tracking-wider text-slate-500">
              ENTRY VERIFICATION
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-6">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            Management
          </p>

          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Admin */}
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 rounded-xl bg-slate-900 p-3">
            <p className="truncate text-sm font-semibold">
              {admin.name}
            </p>

            <p className="mt-1 truncate text-xs text-slate-500">
              {admin.email}
            </p>

            <span className="mt-2 inline-flex rounded-md bg-slate-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {admin.role}
            </span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
          >
            <LogOut size={18} />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}

      {/* Main */}
      <main className="min-h-screen lg:ml-64">
        <div className="px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}