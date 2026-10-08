"use client";

import { useState } from "react";

type Student = {
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
};

type ImportError = {
  row: number;
  error: string;
};

type ImportResult = {
  success?: boolean;
  error?: string;
  missingColumns?: string[];
  fileName?: string;
  sheetName?: string;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  students?: Student[];
  errors?: ImportError[];
  previewLimited?: boolean;
};

export default function ImportStudentsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importComplete, setImportComplete] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  // --------------------------------------------------
  // VALIDATE EXCEL
  // --------------------------------------------------

  async function handleValidate() {
    if (!file) return;

    setLoading(true);
    setResult(null);
    setImportComplete(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/students", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setResult({
          success: false,
          error: data.error || "Import validation failed.",
          missingColumns: data.missingColumns,
        });

        return;
      }

      setResult(data);
    } catch (error) {
      console.error("Validation error:", error);

      setResult({
        success: false,
        error: "Unable to connect to the server.",
      });
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CONFIRM IMPORT
  // --------------------------------------------------

  async function handleConfirmImport() {
    if (!result?.students || result.students.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Import ${result.students.length.toLocaleString()} students into Freshers Gate?`
    );

    if (!confirmed) {
      return;
    }

    setImporting(true);

    try {
      const response = await fetch(
        "/api/import/students/confirm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            students: result.students,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setResult({
          ...result,
          success: false,
          error: data.error || "Student import failed.",
        });

        return;
      }

      setImportComplete(true);

      /*
       * Temporarily store credentials in sessionStorage.
       * We will replace this with the proper QR export system.
       */
      if (data.credentials) {
        sessionStorage.setItem(
          "freshers_gate_import_credentials",
          JSON.stringify(data.credentials)
        );
      }

      alert(
        `${data.imported.toLocaleString()} students imported successfully.`
      );
    } catch (error) {
      console.error("Import error:", error);

      setResult({
        ...result,
        success: false,
        error: "Unable to connect to the server.",
      });
    } finally {
      setImporting(false);
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-slate-500">
          Student Management
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          Import Students
        </h1>

        <p className="mt-2 text-sm text-slate-400">
          Upload the official first-year or second-year
          student list for validation.
        </p>
      </div>

      {/* Upload Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-lg font-semibold">
          Upload Excel File
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Supported formats: .xlsx and .xls
        </p>

        <div className="mt-6">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setResult(null);
              setImportComplete(false);
            }}
            className="block w-full cursor-pointer rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
          />
        </div>

        {/* Selected file */}
        {file && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-sm font-medium">
              {file.name}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}

        <button
          onClick={handleValidate}
          disabled={!file || loading}
          className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Validating..." : "Validate Excel"}
        </button>
      </div>

      {/* --------------------------------------------------
          VALIDATION ERROR
      -------------------------------------------------- */}

      {result?.error && (
        <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
          <p className="font-semibold text-red-400">
            {result.success === false
              ? "Operation Failed"
              : "Validation Failed"}
          </p>

          <p className="mt-2 text-sm text-red-300">
            {result.error}
          </p>

          {result.missingColumns &&
            result.missingColumns.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Missing Columns
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  {result.missingColumns.join(", ")}
                </p>
              </div>
            )}
        </div>
      )}

      {/* --------------------------------------------------
          SUCCESS / VALIDATION RESULT
      -------------------------------------------------- */}

      {result?.success && (
        <div className="mt-6 space-y-6">
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat
              label="Total Rows"
              value={result.totalRows ?? 0}
            />

            <Stat
              label="Valid Rows"
              value={result.validRows ?? 0}
            />

            <Stat
              label="Invalid Rows"
              value={result.invalidRows ?? 0}
            />
          </div>

          {/* File Information */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-slate-500">
                  File
                </p>

                <p className="mt-1 font-medium">
                  {result.fileName}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Sheet
                </p>

                <p className="mt-1 font-medium">
                  {result.sheetName}
                </p>
              </div>
            </div>
          </div>

          {/* Student Preview */}
          {result.students &&
            result.students.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                  <h2 className="font-semibold">
                    Student Preview
                  </h2>

                  <p className="mt-1 text-xs text-slate-500">
                    Showing{" "}
                    {result.students.length.toLocaleString()}{" "}
                    validated student records.
                  </p>
                </div>

                <div className="max-h-[600px] overflow-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="sticky top-0 border-b border-slate-800 bg-slate-950">
                        <tr>
                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            #
                          </th>

                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            Roll No
                          </th>

                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            Student
                          </th>

                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            Program
                          </th>

                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            Branch
                          </th>

                          <th className="px-5 py-3 text-xs uppercase tracking-wide text-slate-500">
                            Year
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.students.map(
                          (student, index) => (
                            <tr
                              key={`${student.rollNo}-${index}`}
                              className="border-b border-slate-800 last:border-0 hover:bg-slate-800/40"
                            >
                              <td className="px-5 py-3 text-slate-600">
                                {index + 1}
                              </td>

                              <td className="px-5 py-3 font-mono text-xs">
                                {student.rollNo}
                              </td>

                              <td className="px-5 py-3">
                                {student.studentName}
                              </td>

                              <td className="px-5 py-3 text-slate-400">
                                {student.program}
                              </td>

                              <td className="px-5 py-3 text-slate-400">
                                {student.branch}
                              </td>

                              <td className="px-5 py-3">
                                {student.year}
                              </td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          {/* Validation Errors */}
          {result.errors &&
            result.errors.length > 0 && (
              <div className="rounded-2xl border border-red-900/40 bg-slate-900 p-5">
                <h2 className="font-semibold text-red-400">
                  Validation Errors
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {result.errors.length} invalid record
                  {result.errors.length === 1 ? "" : "s"} found.
                </p>

                <div className="mt-4 max-h-80 space-y-2 overflow-auto">
                  {result.errors.map((error, index) => (
                    <div
                      key={`${error.row}-${index}`}
                      className="rounded-lg bg-red-950/20 p-3 text-sm"
                    >
                      <span className="font-mono text-red-400">
                        Row {error.row}
                      </span>

                      <span className="ml-3 text-slate-400">
                        {error.error}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* --------------------------------------------------
              CONFIRM IMPORT
          -------------------------------------------------- */}

          {result.students &&
            result.students.length > 0 &&
            !importComplete &&
            (result.invalidRows ?? 0) === 0 && (
              <div className="rounded-2xl border border-amber-900/40 bg-amber-950/10 p-6">
                <h2 className="font-semibold text-amber-400">
                  Ready to Import
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Validation passed. This will create{" "}
                  <span className="font-semibold text-white">
                    {result.students.length.toLocaleString()}
                  </span>{" "}
                  student records in PostgreSQL.
                </p>

                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {importing
                    ? "Importing..."
                    : `Confirm Import (${result.students.length.toLocaleString()})`}
                </button>
              </div>
            )}

          {/* --------------------------------------------------
              IMPORT COMPLETE
          -------------------------------------------------- */}

          {importComplete && (
            <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/20 p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  ✓
                </div>

                <div>
                  <p className="text-lg font-semibold text-emerald-400">
                    Import completed successfully
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    The students have been added to PostgreSQL
                    and their secure QR credentials have been
                    generated.
                  </p>

                  <p className="mt-3 text-xs text-amber-400">
                    Keep the generated QR credential data
                    secure. We will generate the physical QR
                    cards next.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// STAT COMPONENT
// --------------------------------------------------

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value.toLocaleString()}
      </p>
    </div>
  );
}