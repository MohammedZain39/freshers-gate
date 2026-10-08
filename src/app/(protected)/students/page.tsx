"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Users,
  RefreshCw,
  Filter,
  CreditCard,
} from "lucide-react";

type Student = {
  id: string;
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
  status: "ACTIVE" | "INACTIVE";
  hasQrCredential: boolean;
  createdAt: string;
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [branch, setBranch] = useState("");
  const [status, setStatus] = useState("");

  async function loadStudents() {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (year) {
        params.set("year", year);
      }

      if (branch) {
        params.set("branch", branch);
      }

      if (status) {
        params.set("status", status);
      }

      const response = await fetch(
        `/api/students?${params.toString()}`,
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to load students."
        );
      }

      setStudents(data.students || []);
    } catch (error) {
      console.error("Failed to load students:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStudents();
  }, []);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    loadStudents();
  }

  function clearFilters() {
    setSearch("");
    setYear("");
    setBranch("");
    setStatus("");

    setTimeout(() => {
      loadStudents();
    }, 0);
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Student Management
          </p>

          <h1 className="mt-1 text-3xl font-bold">
            Students
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Manage the registered Freshers Gate student database.
          </p>
        </div>

        <button
          onClick={loadStudents}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Overview */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800">
              <Users size={20} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Results
              </p>

              <p className="text-2xl font-bold">
                {students.length.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Active
          </p>

          <p className="mt-2 text-2xl font-bold">
            {
              students.filter(
                (student) => student.status === "ACTIVE"
              ).length
            }
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            QR Ready
          </p>

          <p className="mt-2 text-2xl font-bold">
            {
              students.filter(
                (student) => student.hasQrCredential
              ).length
            }
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={17} className="text-slate-500" />
          <h2 className="font-semibold">
            Search & Filters
          </h2>
        </div>

        <form
          onSubmit={handleSearch}
          className="grid gap-3 lg:grid-cols-[1fr_160px_180px_160px_auto]"
        >
          <div className="relative">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search roll number or student name..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-slate-500"
            />
          </div>

          <select
            value={year}
            onChange={(event) =>
              setYear(event.target.value)
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 outline-none"
          >
            <option value="">All Years</option>
            <option value="1">1st Year</option>
            <option value="2">2nd Year</option>
          </select>

          <select
            value={branch}
            onChange={(event) =>
              setBranch(event.target.value)
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 outline-none"
          >
            <option value="">All Branches</option>
            <option value="CSE">CSE</option>
            <option value="CSE-AIML">CSE-AIML</option>
            <option value="CSE-CS">CSE-CS</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="CE">CE</option>
            <option value="IT">IT</option>
            <option value="ME">ME</option>
          </select>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-300 outline-none"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
            >
              Search
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              Clear
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="font-semibold">
            Student Records
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            {students.length.toLocaleString()} records shown
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading students...
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="text-center">
              <Users
                size={32}
                className="mx-auto text-slate-700"
              />

              <p className="mt-3 text-sm font-medium text-slate-400">
                No students found
              </p>

              <p className="mt-1 text-xs text-slate-600">
                Try changing your search or filters.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-h-[650px] overflow-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950">
                <tr>
                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Roll No
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Student
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Branch
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Year
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    QR
                  </th>

                  <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-3 font-mono text-xs font-medium">
                      {student.rollNo}
                    </td>

                    <td className="px-5 py-3">
                      <p className="font-medium">
                        {student.studentName}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-600">
                        {student.program}
                      </p>
                    </td>

                    <td className="px-5 py-3 text-slate-400">
                      {student.branch}
                    </td>

                    <td className="px-5 py-3 text-slate-400">
                      Year {student.year}
                    </td>

                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          student.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {student.status}
                      </span>
                    </td>

                    <td className="px-5 py-3">
                      {student.hasQrCredential ? (
                        <span className="text-xs font-medium text-emerald-400">
                          Ready
                        </span>
                      ) : (
                        <span className="text-xs text-amber-400">
                          Not generated
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-3">
                      <Link
                        href={`/students/${student.id}`}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                      >
                        <CreditCard size={14} />
                        Digital ID
                      </Link>
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