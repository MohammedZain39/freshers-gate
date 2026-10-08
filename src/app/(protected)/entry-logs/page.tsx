"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Search,
  Users,
  RefreshCw,
  UserCheck,
} from "lucide-react";

type EntryLog = {
  id: string;
  scannedAt: string;
  result: "ALLOWED";

  student: {
    id: string;
    rollNo: string;
    studentName: string;
    program: string;
    branch: string;
    year: number;
    enteredAt: string | null;
  };

  scanner: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type Stats = {
  totalAllowed: number;
  totalStudents: number;
  remaining: number;
};

const branches = [
  "ALL",
  "CSE",
  "CSE-AIML",
  "CSE-CS",
  "ECE",
  "EEE",
  "CE",
  "IT",
  "ME",
];

function formatIST(date: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));
}

export default function EntryLogsPage() {
  const [logs, setLogs] = useState<EntryLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalAllowed: 0,
    totalStudents: 0,
    remaining: 0,
  });

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("ALL");
  const [branch, setBranch] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadLogs = useCallback(
    async (manualRefresh = false) => {
      try {
        if (manualRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");

        const params = new URLSearchParams();

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (year !== "ALL") {
          params.set("year", year);
        }

        if (branch !== "ALL") {
          params.set("branch", branch);
        }

        const response = await fetch(
          `/api/entry-logs?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load entry logs."
          );
        }

        setLogs(data.logs || []);
        setStats(
          data.stats || {
            totalAllowed: 0,
            totalStudents: 0,
            remaining: 0,
          }
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load entry logs."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, year, branch]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadLogs();
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadLogs]);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-emerald-400" />

            <h1 className="text-2xl font-semibold text-white">
              Entry Logs
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-400">
            Real-time record of successful student entries.
          </p>
        </div>

        <button
          onClick={() => loadLogs(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${
              refreshing ? "animate-spin" : ""
            }`}
          />

          Refresh
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Students Entered"
          value={stats.totalAllowed}
          icon={<CheckCircle2 className="h-5 w-5" />}
          description="Successful entries"
        />

        <StatCard
          title="Total Eligible"
          value={stats.totalStudents}
          icon={<Users className="h-5 w-5" />}
          description="Active 1st & 2nd year"
        />

        <StatCard
          title="Remaining"
          value={stats.remaining}
          icon={<Clock3 className="h-5 w-5" />}
          description="Students yet to enter"
        />
      </div>

      {/* FILTERS */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
          {/* SEARCH */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or roll number..."
              className="h-11 w-full rounded-xl border border-slate-800 bg-slate-900 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
          </div>

          {/* YEAR */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
          </select>

          {/* BRANCH */}
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="h-11 rounded-xl border border-slate-800 bg-slate-900 px-3 text-sm text-slate-200 outline-none focus:border-emerald-500"
          >
            {branches.map((item) => (
              <option key={item} value={item}>
                {item === "ALL" ? "All Branches" : item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-medium text-white">
              Successful Entries
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing up to 500 latest successful entries.
            </p>
          </div>

          <span className="rounded-full border border-emerald-900/50 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400">
            {logs.length} shown
          </span>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-full border border-slate-800 bg-slate-900 p-4">
              <UserCheck className="h-6 w-6 text-slate-500" />
            </div>

            <h3 className="font-medium text-slate-300">
              No successful entries yet
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              When a valid student successfully enters while
              the event is active, their entry will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    #
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Student
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Roll Number
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Year
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Branch
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Entry Time
                  </th>

                  <th className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-slate-500">
                    Result
                  </th>
                </tr>
              </thead>

              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-900 transition hover:bg-slate-900/50"
                  >
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {index + 1}
                    </td>

                    <td className="px-5 py-4">
                      <div className="font-medium text-white">
                        {log.student.studentName}
                      </div>

                      <div className="mt-0.5 text-xs text-slate-500">
                        {log.student.program}
                      </div>
                    </td>

                    <td className="px-5 py-4 font-mono text-sm text-slate-300">
                      {log.student.rollNo}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-300">
                      {log.student.year === 1
                        ? "1st Year"
                        : "2nd Year"}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-300">
                      {log.student.branch}
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-sm text-slate-200">
                        {formatIST(log.scannedAt)}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        IST
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ALLOWED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500">{title}</p>

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