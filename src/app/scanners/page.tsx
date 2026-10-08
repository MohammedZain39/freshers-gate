"use client";

import { FormEvent, useEffect, useState } from "react";

import {
  getLocalGateSession,
} from "@/lib/offline/session";
import {
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  KeyRound,
} from "lucide-react";

type Scanner = {
  id: string;
  name: string;
  email: string;
  role: "SCANNER";
  createdAt: string;
};

export default function ScannersPage() {
  const [scanners, setScanners] = useState<Scanner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function loadScanners() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/scanners", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load scanners.");
      }

      setScanners(data.scanners || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load scanners."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadScanners();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/scanners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to create scanner."
        );
      }

      setSuccess(
        `Scanner account created for ${data.scanner.name}.`
      );

      setName("");
      setEmail("");
      setPassword("");

      await loadScanners();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create scanner."
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-950">
              <Smartphone size={21} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">
                Scanner Accounts
              </h1>

              <p className="text-sm text-slate-400">
                Manage gate operators and scanner access.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadScanners}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Create Scanner */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-white">
              <Plus size={19} />
            </div>

            <div>
              <h2 className="font-semibold text-white">
                Create Scanner
              </h2>

              <p className="text-xs text-slate-500">
                Create an operator login.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleCreate}
            className="space-y-4"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Scanner Name
              </label>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Gate 1 Operator"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gate1@freshersgate.local"
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Password
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                minLength={8}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <Plus size={17} />
              )}

              {creating
                ? "Creating..."
                : "Create Scanner Account"}
            </button>
          </form>
        </div>

        {/* Scanner List */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white">
                  Scanner Operators
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {scanners.length} scanner account
                  {scanners.length !== 1 ? "s" : ""}
                </p>
              </div>

              <ShieldCheck
                size={20}
                className="text-slate-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2
                size={24}
                className="animate-spin text-slate-400"
              />
            </div>
          ) : scanners.length === 0 ? (
            <div className="p-12 text-center">
              <Smartphone
                size={32}
                className="mx-auto mb-3 text-slate-600"
              />

              <p className="text-sm text-slate-400">
                No scanner accounts yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {scanners.map((scanner, index) => (
                <div
                  key={scanner.id}
                  className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-sm font-bold text-slate-300">
                      {index + 1}
                    </div>

                    <div>
                      <p className="font-medium text-white">
                        {scanner.name}
                      </p>

                      <p className="text-sm text-slate-500">
                        {scanner.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      SCANNER
                    </span>

                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-500">
                      <KeyRound size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}