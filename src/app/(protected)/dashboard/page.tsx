"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Users,
  UserCheck,
  UserRound,
  X,
  Play,
  Square,
} from "lucide-react";

type DashboardStats = {
  totalStudents: number;
  firstYear: number;
  secondYear: number;
  activeStudents: number;
  enteredStudents: number;
  allowedEntries: number;
  remaining: number;
};

type EventState = {
  id: string | null;
  name: string;
  entryEnabled: boolean;
  startedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string | null;
};

const emptyStats: DashboardStats = {
  totalStudents: 0,
  firstYear: 0,
  secondYear: 0,
  activeStudents: 0,
  enteredStudents: 0,
  allowedEntries: 0,
  remaining: 0,
};

export default function DashboardPage() {
  const [stats, setStats] =
    useState<DashboardStats>(emptyStats);

  const [event, setEvent] = useState<EventState>({
    id: null,
    name: "Freshers 2K26",
    entryEnabled: false,
    startedAt: null,
    stoppedAt: null,
    updatedAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [controlLoading, setControlLoading] =
    useState(false);

  const [modalAction, setModalAction] = useState<
    "START" | "STOP" | null
  >(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadDashboard = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const response = await fetch("/api/dashboard", {
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load dashboard."
          );
        }

        setStats(data.stats || emptyStats);
        setEvent(data.event);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard(true);
    }, 15000);

    return () => clearInterval(interval);
  }, [loadDashboard]);

  async function changeEventState(
    action: "START" | "STOP"
  ) {
    try {
      setControlLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        "/api/event-control",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to update event status."
        );
      }

      setEvent(data.event);

      setMessage(
        action === "START"
          ? "Freshers Gate entry is now ACTIVE."
          : "Freshers Gate entry is now CLOSED."
      );

      setModalAction(null);

      await loadDashboard(true);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update event status."
      );
    } finally {
      setControlLoading(false);
    }
  }

  function formatIST(date: string | null) {
    if (!date) return "—";

    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Kolkata",
    }).format(new Date(date));
  }

  const attendancePercentage =
    stats.activeStudents > 0
      ? Math.min(
          (stats.enteredStudents /
            stats.activeStudents) *
            100,
          100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/40 p-2.5">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-white">
                Freshers Gate
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Student Entry Verification Dashboard
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => loadDashboard(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* ERROR */}

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* MESSAGE */}

      {message && (
        <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {/* EVENT CONTROL */}

      <div
        className={`rounded-2xl border p-5 ${
          event.entryEnabled
            ? "border-emerald-900/60 bg-emerald-950/20"
            : "border-amber-900/50 bg-amber-950/10"
        }`}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  event.entryEnabled
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                    : "bg-amber-400"
                }`}
              />

              <h2 className="text-lg font-semibold text-white">
                Entry Control
              </h2>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  event.entryEnabled
                    ? "bg-emerald-950/60 text-emerald-400"
                    : "bg-amber-950/60 text-amber-400"
                }`}
              >
                {event.entryEnabled
                  ? "ENTRY ACTIVE"
                  : "ENTRY CLOSED"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              {event.entryEnabled
                ? "Students can currently enter through QR verification."
                : "QR verification is currently closed. Scans will not count as attendance."}
            </p>

            {event.entryEnabled && event.startedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Started: {formatIST(event.startedAt)} IST
              </p>
            )}

            {!event.entryEnabled && event.stoppedAt && (
              <p className="mt-2 text-xs text-slate-500">
                Stopped: {formatIST(event.stoppedAt)} IST
              </p>
            )}
          </div>

          <div>
            {event.entryEnabled ? (
              <button
                onClick={() => setModalAction("STOP")}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                <Square className="h-4 w-4 fill-current" />
                Stop Entry
              </button>
            ) : (
              <button
                onClick={() => setModalAction("START")}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <Play className="h-4 w-4 fill-current" />
                Start Entry
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN STATS */}

      {loading ? (
        <div className="flex min-h-[250px] items-center justify-center">
          <RefreshCw className="h-7 w-7 animate-spin text-slate-500" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              description="1st & 2nd year"
              icon={
                <Users className="h-5 w-5" />
              }
            />

            <StatCard
              title="Students Entered"
              value={stats.enteredStudents}
              description="Successful ALLOWED entries"
              icon={
                <CheckCircle2 className="h-5 w-5" />
              }
            />

            <StatCard
              title="Remaining"
              value={stats.remaining}
              description="Yet to enter"
              icon={
                <Clock3 className="h-5 w-5" />
              }
            />

            <StatCard
              title="Active Students"
              value={stats.activeStudents}
              description="Currently eligible"
              icon={
                <UserCheck className="h-5 w-5" />
              }
            />
          </div>

          {/* YEAR BREAKDOWN */}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-white">
                    Student Distribution
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Eligible students by year
                  </p>
                </div>

                <UserRound className="h-5 w-5 text-slate-500" />
              </div>

              <div className="mt-6 space-y-5">
                <ProgressRow
                  label="1st Year"
                  value={stats.firstYear}
                  total={stats.totalStudents}
                />

                <ProgressRow
                  label="2nd Year"
                  value={stats.secondYear}
                  total={stats.totalStudents}
                />
              </div>
            </div>

            {/* ATTENDANCE */}

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-white">
                    Entry Progress
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Successful entries against active students
                  </p>
                </div>

                <Activity className="h-5 w-5 text-emerald-400" />
              </div>

              <div className="mt-6">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-semibold text-white">
                      {attendancePercentage.toFixed(1)}%
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Entry completion
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-400">
                      {stats.enteredStudents.toLocaleString()}
                    </p>

                    <p className="text-xs text-slate-500">
                      of{" "}
                      {stats.activeStudents.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{
                      width: `${attendancePercentage}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SYSTEM STATUS */}

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-slate-400" />

              <div>
                <h2 className="font-medium text-white">
                  System Status
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Freshers Gate database and entry system
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              <StatusItem
                label="Student Database"
                status={`${stats.totalStudents.toLocaleString()} records`}
              />

              <StatusItem
                label="Entry Verification"
                status={
                  event.entryEnabled
                    ? "ACTIVE"
                    : "CLOSED"
                }
              />

              <StatusItem
                label="Successful Entries"
                status={`${stats.allowedEntries.toLocaleString()} recorded`}
              />
            </div>
          </div>
        </>
      )}

      {/* CONFIRMATION MODAL */}

      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <h3 className="font-semibold text-white">
                {modalAction === "START"
                  ? "Start Entry?"
                  : "Stop Entry?"}
              </h3>

              <button
                onClick={() =>
                  setModalAction(null)
                }
                disabled={controlLoading}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-900 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-5">
              {modalAction === "START" ? (
                <p className="text-sm leading-6 text-slate-400">
                  This will activate Freshers Gate entry.
                  Valid 1st and 2nd year students will be
                  able to enter by scanning their QR codes.
                </p>
              ) : (
                <p className="text-sm leading-6 text-slate-400">
                  This will immediately close entry.
                  QR scans after this point will not count
                  as attendance.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-800 px-5 py-4">
              <button
                onClick={() =>
                  setModalAction(null)
                }
                disabled={controlLoading}
                className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={() =>
                  changeEventState(modalAction)
                }
                disabled={controlLoading}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                  modalAction === "START"
                    ? "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    : "bg-red-500 text-white hover:bg-red-400"
                }`}
              >
                {controlLoading && (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}

                {modalAction === "START"
                  ? "Start Entry"
                  : "Stop Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
            {value.toLocaleString()}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {description}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5 text-emerald-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage =
    total > 0 ? (value / total) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">
          {label}
        </span>

        <span className="text-sm font-medium text-white">
          {value.toLocaleString()}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-slate-400 transition-all duration-500"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      <p className="mt-1 text-xs text-slate-600">
        {percentage.toFixed(1)}% of total
      </p>
    </div>
  );
}

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400" />

        <span className="text-xs text-slate-500">
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm font-medium text-slate-200">
        {status}
      </p>
    </div>
  );
}