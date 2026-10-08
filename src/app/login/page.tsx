"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      // =========================================
      // OFFLINE LOGIN
      // =========================================

      if (!navigator.onLine) {
        try {
          const { offlineLogin } = await import(
            "@/lib/offline/auth"
          );

          const localUser = await offlineLogin(password);

          if (!localUser) {
            setError(
              "Offline login failed. This device has not been authorized for offline use, or the password is incorrect."
            );
            return;
          }

          if (
            localUser.role !== "SCANNER" &&
            localUser.role !== "ADMIN"
          ) {
            setError(
              "This account is not authorized to use Freshers Gate."
            );
            return;
          }

          // Save/refresh local gate session
          const { saveLocalGateSession } = await import(
            "@/lib/offline/session"
          );

          await saveLocalGateSession({
            id: localUser.id,
            name: localUser.name,
            role: localUser.role,
            authenticatedAt: new Date().toISOString(),
          });

          router.replace("/gate");
          router.refresh();

          return;
        } catch (offlineError) {
          console.error(
            "Offline login error:",
            offlineError
          );

          setError(
            "Unable to perform offline login."
          );

          return;
        }
      }

      // =========================================
      // ONLINE LOGIN
      // =========================================

      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        }
      );

      let data: {
        success?: boolean;
        redirectTo?: string;
        error?: string;
        user?: {
          id: string;
          name: string;
          email: string;
          role: "ADMIN" | "SCANNER";
        };
      };

      try {
        data = await response.json();
      } catch {
        setError(
          "Server returned an invalid response."
        );
        return;
      }

      if (!response.ok) {
        setError(
          data.error ||
            "Invalid email or password."
        );
        return;
      }

      if (!data.success || !data.user) {
        setError(
          data.error ||
            "Authentication failed."
        );
        return;
      }

      // =========================================
      // SAVE OFFLINE AUTHORIZATION
      // =========================================

      const { saveOfflineAuth } = await import(
        "@/lib/offline/auth"
      );

      await saveOfflineAuth(
        password,
        {
          id: data.user.id,
          name: data.user.name,
          role: data.user.role,
        }
      );

      // =========================================
      // SAVE LOCAL GATE SESSION
      // =========================================

      const { saveLocalGateSession } =
        await import(
          "@/lib/offline/session"
        );

      await saveLocalGateSession({
        id: data.user.id,
        name: data.user.name,
        role: data.user.role,
        authenticatedAt:
          new Date().toISOString(),
      });

      // =========================================
      // ROLE-BASED REDIRECT
      // =========================================

      if (data.redirectTo) {
        router.replace(
          data.redirectTo
        );
      } else {
        router.replace("/dashboard");
      }

      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md">

        {/* BRAND */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-950">
            <ShieldCheck size={28} />
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-white">
            Freshers Gate
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Student Entry Verification System
          </p>
        </div>

        {/* LOGIN CARD */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">

          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">
              Secure Login
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Sign in to access Freshers Gate.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >

            {/* EMAIL */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                placeholder="admin@freshersgate.local"
                autoComplete="email"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
              />
            </div>

            {/* PASSWORD */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-slate-400"
              />
            </div>

            {/* ERROR */}
            {error && (
              <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              )}

              {loading
                ? "Signing in..."
                : "Sign in"}
            </button>

          </form>
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Freshers Gate • Secure Entry Management
        </p>

      </div>
    </main>
  );
}