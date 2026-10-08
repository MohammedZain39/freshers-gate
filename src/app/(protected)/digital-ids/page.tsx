"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Users,
  Eye,
  RefreshCw,
  Loader2,
  CheckSquare,
  Square,
  QrCode,
  X,
  FileDown,
  Download,
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
};

type BulkResult = {
  generated: number;
  skippedExisting: number;
  processed: number;
};

type PdfMode =
  | "ALL"
  | "YEAR"
  | "BRANCH"
  | "YEAR_BRANCH"
  | "SELECTED";

export default function DigitalIdsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [generatingQr, setGeneratingQr] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("ALL");
  const [branch, setBranch] = useState("ALL");
  const [qrStatus, setQrStatus] = useState("ALL");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set()
  );

  const [bulkResult, setBulkResult] =
    useState<BulkResult | null>(null);

  // PDF generator state
  const [pdfMode, setPdfMode] = useState<PdfMode>("ALL");
  const [pdfYear, setPdfYear] = useState("1");
  const [pdfBranch, setPdfBranch] = useState("");

  async function loadStudents() {
    try {
      setLoading(true);

      const response = await fetch("/api/students", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load students.");
      }

      const data = await response.json();

      setStudents(
        Array.isArray(data.students)
          ? data.students
          : []
      );

      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to load students:", error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  async function refreshStudents() {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  }

  useEffect(() => {
    loadStudents();
  }, []);

  const branches = useMemo(() => {
    return Array.from(
      new Set(students.map((student) => student.branch))
    ).sort();
  }, [students]);

  useEffect(() => {
    if (!pdfBranch && branches.length > 0) {
      setPdfBranch(branches[0]);
    }
  }, [branches, pdfBranch]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.rollNo.toLowerCase().includes(query) ||
        student.studentName.toLowerCase().includes(query);

      const matchesYear =
        year === "ALL" ||
        student.year.toString() === year;

      const matchesBranch =
        branch === "ALL" ||
        student.branch === branch;

      const matchesQr =
        qrStatus === "ALL" ||
        (qrStatus === "READY" &&
          student.hasQrCredential) ||
        (qrStatus === "MISSING" &&
          !student.hasQrCredential);

      return (
        matchesSearch &&
        matchesYear &&
        matchesBranch &&
        matchesQr
      );
    });
  }, [
    students,
    search,
    year,
    branch,
    qrStatus,
  ]);

  const totalStudents = students.length;

  const generatedCount = students.filter(
    (student) => student.hasQrCredential
  ).length;

  const pendingCount =
    totalStudents - generatedCount;

  const activeCount = students.filter(
    (student) => student.status === "ACTIVE"
  ).length;

  const filteredIds = filteredStudents.map(
    (student) => student.id
  );

  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) =>
      selectedIds.has(id)
    );

  function toggleStudent(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        filteredIds.forEach((id) =>
          next.delete(id)
        );
      } else {
        filteredIds.forEach((id) =>
          next.add(id)
        );
      }

      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function generateBulkQr() {
    if (selectedIds.size === 0) return;

    if (selectedIds.size > 500) {
      alert(
        "Please select 500 or fewer students at a time."
      );
      return;
    }

    const confirmed = window.confirm(
      `Generate QR credentials for ${selectedIds.size} selected student(s)?\n\nExisting QR credentials will be skipped.`
    );

    if (!confirmed) return;

    try {
      setGeneratingQr(true);
      setBulkResult(null);

      const response = await fetch(
        "/api/students/bulk-qr",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentIds: Array.from(selectedIds),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Bulk QR generation failed."
        );
      }

      setBulkResult({
        generated: data.generated ?? 0,
        skippedExisting:
          data.skippedExisting ?? 0,
        processed: data.processed ?? 0,
      });

      await loadStudents();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Bulk QR generation failed."
      );
    } finally {
      setGeneratingQr(false);
    }
  }

  /*
   * Determines which students will be included
   * in the PDF based on the selected generation mode.
   */
  const pdfStudents = useMemo(() => {
    const activeStudents = students.filter(
      (student) => student.status === "ACTIVE"
    );

    switch (pdfMode) {
      case "ALL":
        return activeStudents;

      case "YEAR":
        return activeStudents.filter(
          (student) =>
            student.year.toString() === pdfYear
        );

      case "BRANCH":
        return activeStudents.filter(
          (student) =>
            student.branch === pdfBranch
        );

      case "YEAR_BRANCH":
        return activeStudents.filter(
          (student) =>
            student.year.toString() === pdfYear &&
            student.branch === pdfBranch
        );

      case "SELECTED":
        return activeStudents.filter((student) =>
          selectedIds.has(student.id)
        );

      default:
        return [];
    }
  }, [
    students,
    pdfMode,
    pdfYear,
    pdfBranch,
    selectedIds,
  ]);

  /*
   * Generate and download PDF.
   *
   * The backend decides which students are included.
   * For ALL/YEAR/BRANCH/YEAR_BRANCH we do NOT send
   * thousands of student IDs from the browser.
   */
  async function generateDigitalIds() {
    if (pdfStudents.length === 0) {
      alert(
        "No active students match the selected PDF scope."
      );
      return;
    }

    if (pdfStudents.length > 2500) {
      alert(
        "This PDF batch is larger than the supported limit of 2500 students."
      );
      return;
    }

    let scopeText = "";

    switch (pdfMode) {
      case "ALL":
        scopeText = `ALL ACTIVE STUDENTS (${pdfStudents.length})`;
        break;

      case "YEAR":
        scopeText = `${pdfYear === "1" ? "1st" : "2nd"} YEAR (${pdfStudents.length})`;
        break;

      case "BRANCH":
        scopeText = `${pdfBranch} (${pdfStudents.length})`;
        break;

      case "YEAR_BRANCH":
        scopeText = `${pdfYear === "1" ? "1st" : "2nd"} YEAR - ${pdfBranch} (${pdfStudents.length})`;
        break;

      case "SELECTED":
        scopeText = `SELECTED STUDENTS (${pdfStudents.length})`;
        break;
    }

    const confirmed = window.confirm(
      `Generate Digital ID PDF?\n\n${scopeText}\n\nEach student will receive one Digital ID page.\n\nIMPORTANT: New QR credentials will be generated for these students and their previous QR credentials will be invalidated.`
    );

    if (!confirmed) return;

    try {
      setGeneratingPdf(true);

      const payload: {
        mode: PdfMode;
        year?: number;
        branch?: string;
        studentIds?: string[];
      } = {
        mode: pdfMode,
      };

      if (
        pdfMode === "YEAR" ||
        pdfMode === "YEAR_BRANCH"
      ) {
        payload.year = Number(pdfYear);
      }

      if (
        pdfMode === "BRANCH" ||
        pdfMode === "YEAR_BRANCH"
      ) {
        payload.branch = pdfBranch;
      }

      if (pdfMode === "SELECTED") {
        payload.studentIds = Array.from(selectedIds);
      }

      const response = await fetch(
        "/api/students/bulk-digital-ids",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        let message =
          "Failed to generate Digital ID PDF.";

        try {
          const data = await response.json();

          if (data.error) {
            message = data.error;
          }
        } catch {
          // Ignore invalid error response.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      /*
       * Try to use the filename returned by the API.
       */
      let filename =
        "freshers-digital-ids.pdf";

      const disposition =
        response.headers.get(
          "Content-Disposition"
        );

      if (disposition) {
        const match =
          disposition.match(
            /filename="?([^"]+)"?/i
          );

        if (match?.[1]) {
          filename = match[1];
        }
      }

      const downloadUrl =
        window.URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = downloadUrl;
      anchor.download = filename;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.URL.revokeObjectURL(
        downloadUrl
      );

      clearSelection();

      await loadStudents();

      alert(
        `Digital ID PDF generated successfully.\n\n${pdfStudents.length} student page(s) included.`
      );
    } catch (error) {
      console.error(
        "Digital ID generation error:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Failed to generate Digital ID PDF."
      );
    } finally {
      setGeneratingPdf(false);
    }
  }

  const busy =
    generatingQr || generatingPdf;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5">
              <CreditCard className="h-6 w-6 text-cyan-400" />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">
                Digital IDs
              </h1>

              <p className="mt-1 text-sm text-slate-400">
                Generate student Digital ID cards
                and QR entry credentials.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={refreshStudents}
          disabled={refreshing || busy}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}

          Refresh
        </button>
      </div>

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          icon={<Users className="h-5 w-5" />}
          description="Imported students"
        />

        <StatCard
          title="QR Generated"
          value={generatedCount}
          icon={
            <CheckCircle2 className="h-5 w-5" />
          }
          description="Digital ID ready"
        />

        <StatCard
          title="QR Pending"
          value={pendingCount}
          icon={
            <AlertCircle className="h-5 w-5" />
          }
          description="Credential not generated"
        />

        <StatCard
          title="Active Students"
          value={activeCount}
          icon={
            <CreditCard className="h-5 w-5" />
          }
          description="Eligible for entry"
        />
      </div>

      {/* ====================================================== */}
      {/* DIGITAL ID PDF GENERATOR                              */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-cyan-400/20 bg-slate-900/70 p-5 shadow-xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FileDown className="h-5 w-5 text-cyan-400" />

              <h2 className="text-lg font-semibold text-white">
                Digital ID PDF Generator
              </h2>
            </div>

            <p className="mt-1 text-sm text-slate-400">
              Generate one Digital ID card per student,
              with one student per PDF page.
            </p>
          </div>

          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300">
            Generating a PDF creates new QR credentials
            for the included students.
          </div>
        </div>

        {/* SCOPE OPTIONS */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <PdfScopeButton
            active={pdfMode === "ALL"}
            onClick={() => setPdfMode("ALL")}
            title="All Students"
            description={`${activeCount.toLocaleString()} active`}
          />

          <PdfScopeButton
            active={pdfMode === "YEAR"}
            onClick={() => setPdfMode("YEAR")}
            title="By Year"
            description="1st / 2nd year"
          />

          <PdfScopeButton
            active={pdfMode === "BRANCH"}
            onClick={() => setPdfMode("BRANCH")}
            title="By Branch"
            description="Single branch"
          />

          <PdfScopeButton
            active={pdfMode === "YEAR_BRANCH"}
            onClick={() =>
              setPdfMode("YEAR_BRANCH")
            }
            title="Year + Branch"
            description="Specific group"
          />

          <PdfScopeButton
            active={pdfMode === "SELECTED"}
            onClick={() =>
              setPdfMode("SELECTED")
            }
            title="Selected"
            description={`${selectedIds.size} selected`}
          />
        </div>

        {/* CONDITIONAL FILTERS */}
        {(pdfMode === "YEAR" ||
          pdfMode === "YEAR_BRANCH") && (
          <div className="mt-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Year
            </label>

            <select
              value={pdfYear}
              onChange={(e) =>
                setPdfYear(e.target.value)
              }
              disabled={busy}
              className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              <option value="1">
                1st Year
              </option>

              <option value="2">
                2nd Year
              </option>
            </select>
          </div>
        )}

        {(pdfMode === "BRANCH" ||
          pdfMode === "YEAR_BRANCH") && (
          <div className="mt-4">
            <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Branch
            </label>

            <select
              value={pdfBranch}
              onChange={(e) =>
                setPdfBranch(e.target.value)
              }
              disabled={busy}
              className="w-full max-w-md rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
            >
              {branches.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* PDF PREVIEW SUMMARY */}
        <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                PDF Scope
              </p>

              <p className="mt-1 text-sm font-semibold text-white">
                {pdfMode === "ALL" &&
                  "All Active Students"}

                {pdfMode === "YEAR" &&
                  `${pdfYear === "1" ? "1st" : "2nd"} Year Students`}

                {pdfMode === "BRANCH" &&
                  `${pdfBranch} Students`}

                {pdfMode === "YEAR_BRANCH" &&
                  `${pdfYear === "1" ? "1st" : "2nd"} Year • ${pdfBranch}`}

                {pdfMode === "SELECTED" &&
                  "Selected Students"}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-slate-500">
                  Pages
                </p>

                <p className="text-xl font-bold text-cyan-400">
                  {pdfStudents.length.toLocaleString()}
                </p>
              </div>

              <button
                onClick={generateDigitalIds}
                disabled={
                  busy ||
                  pdfStudents.length === 0 ||
                  pdfStudents.length > 2500
                }
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating PDF...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Generate & Download PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {pdfStudents.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Format A: 1 student = 1 Digital ID
              page. Current batch contains{" "}
              <span className="font-semibold text-slate-300">
                {pdfStudents.length.toLocaleString()}
              </span>{" "}
              students.
            </p>
          )}
        </div>
      </section>

      {/* ====================================================== */}
      {/* SELECTION ACTION BAR                                  */}
      {/* ====================================================== */}

      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-20 rounded-2xl border border-cyan-400/20 bg-slate-900/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">
                {selectedIds.size.toLocaleString()}{" "}
                student
                {selectedIds.size === 1
                  ? ""
                  : "s"}{" "}
                selected
              </p>

              <p className="mt-1 text-xs text-slate-400">
                You can generate QR credentials or use
                this selection for the PDF generator.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={clearSelection}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>

              <button
                onClick={generateBulkQr}
                disabled={
                  busy ||
                  selectedIds.size > 500
                }
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generatingQr ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    Generate Missing QR
                  </>
                )}
              </button>

              <button
                onClick={() =>
                  setPdfMode("SELECTED")
                }
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
              >
                <FileDown className="h-4 w-4" />
                Use Selection for PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK QR RESULT */}
      {bulkResult && (
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-400" />

            <div>
              <p className="text-sm font-semibold text-emerald-300">
                QR generation completed
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Processed:{" "}
                {bulkResult.processed}
                {" • "}
                Generated:{" "}
                {bulkResult.generated}
                {" • "}
                Existing skipped:{" "}
                {bulkResult.skippedExisting}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================== */}
      {/* FILTERS                                               */}
      {/* ====================================================== */}

      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search name or roll number..."
              className="w-full rounded-xl border border-white/10 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
            />
          </div>

          <select
            value={year}
            onChange={(e) =>
              setYear(e.target.value)
            }
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
          >
            <option value="ALL">
              All Years
            </option>

            <option value="1">
              1st Year
            </option>

            <option value="2">
              2nd Year
            </option>
          </select>

          <select
            value={branch}
            onChange={(e) =>
              setBranch(e.target.value)
            }
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
          >
            <option value="ALL">
              All Branches
            </option>

            {branches.map((item) => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ))}
          </select>

          <select
            value={qrStatus}
            onChange={(e) =>
              setQrStatus(e.target.value)
            }
            className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-400/40"
          >
            <option value="ALL">
              All QR Status
            </option>

            <option value="READY">
              QR Ready
            </option>

            <option value="MISSING">
              QR Missing
            </option>
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Showing{" "}
            <span className="font-semibold text-slate-300">
              {filteredStudents.length.toLocaleString()}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-300">
              {totalStudents.toLocaleString()}
            </span>{" "}
            students
          </span>

          {selectedIds.size > 0 && (
            <span className="text-cyan-400">
              {selectedIds.size.toLocaleString()} selected
            </span>
          )}
        </div>
      </section>

      {/* ====================================================== */}
      {/* STUDENT TABLE                                         */}
      {/* ====================================================== */}

      <section className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="w-12 px-4 py-3">
                  <button
                    onClick={toggleAllFiltered}
                    disabled={
                      filteredStudents.length === 0 ||
                      busy
                    }
                    className="text-slate-400 hover:text-white disabled:opacity-40"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="h-4 w-4 text-cyan-400" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>

                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Student
                </th>

                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Roll No
                </th>

                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Branch
                </th>

                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Year
                </th>

                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  QR Status
                </th>

                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-cyan-400" />

                    <p className="mt-3 text-sm text-slate-500">
                      Loading students...
                    </p>
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center"
                  >
                    <Users className="mx-auto h-8 w-8 text-slate-700" />

                    <p className="mt-3 text-sm font-medium text-slate-400">
                      No students found
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Try changing your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map(
                  (student) => {
                    const selected =
                      selectedIds.has(
                        student.id
                      );

                    return (
                      <tr
                        key={student.id}
                        className={`transition ${
                          selected
                            ? "bg-cyan-400/[0.04]"
                            : "hover:bg-white/[0.02]"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              toggleStudent(
                                student.id
                              )
                            }
                            disabled={busy}
                            className="text-slate-500 hover:text-white disabled:opacity-40"
                          >
                            {selected ? (
                              <CheckSquare className="h-4 w-4 text-cyan-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-white">
                              {student.studentName}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {student.program}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm font-medium text-slate-300">
                          {student.rollNo}
                        </td>

                        <td className="px-4 py-3 text-sm text-slate-400">
                          {student.branch}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-slate-300">
                            {student.year === 1
                              ? "1st"
                              : "2nd"}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {student.hasQrCredential ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Missing
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/students/${student.id}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ========================================================== */
/* COMPONENTS                                                 */
/* ========================================================== */

function PdfScopeButton({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={`rounded-xl border p-4 text-left transition ${
        active
          ? "border-cyan-400/40 bg-cyan-400/10"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
      }`}
    >
      <p
        className={`text-sm font-semibold ${
          active
            ? "text-cyan-300"
            : "text-white"
        }`}
      >
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>
    </button>
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
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-white">
            {value.toLocaleString()}
          </p>

          <p className="mt-1 text-xs text-slate-600">
            {description}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-cyan-400">
          {icon}
        </div>
      </div>
    </div>
  );
}