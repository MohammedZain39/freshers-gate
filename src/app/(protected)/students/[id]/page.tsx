"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import DigitalIdCard from "@/components/admin/DigitalIdCard";

type Student = {
  id: string;
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
  status: "ACTIVE" | "INACTIVE";
};

export default function StudentCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [qrCredential, setQrCredential] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // Resolve dynamic route params
  useEffect(() => {
    params.then((value) => {
      setStudentId(value.id);
    });
  }, [params]);

  // Load student
  useEffect(() => {
    if (!studentId) return;

    async function loadStudent() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/students/${studentId}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Failed to load student."
          );
        }

        setStudent(data.student);
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "Failed to load student."
        );
      } finally {
        setLoading(false);
      }
    }

    loadStudent();
  }, [studentId]);

  async function generateDigitalId() {
    if (!studentId) return;

    setGenerating(true);
    setError("");

    try {
      const response = await fetch(
        `/api/students/${studentId}/qr`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to generate QR."
        );
      }

      setStudent(data.student);
      setQrCredential(data.qrCredential);
    } catch (error) {
      console.error(error);

      setError(
        error instanceof Error
          ? error.message
          : "Failed to generate QR."
      );
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2
          size={28}
          className="animate-spin text-slate-500"
        />
      </div>
    );
  }

  if (error && !student) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link
          href="/students"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Students
        </Link>

        <div className="mt-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-6">
          <p className="font-semibold text-red-400">
            Failed to load student
          </p>

          <p className="mt-2 text-sm text-red-300">
            {error}
          </p>
        </div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/students"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Students
        </Link>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Student Management
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Digital ID Card
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              {student.studentName} · {student.rollNo}
            </p>
          </div>

          {!qrCredential && (
            <button
              onClick={generateDigitalId}
              disabled={generating || student.status !== "ACTIVE"}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                  Generating...
                </>
              ) : (
                <>
                  <CreditCard size={17} />
                  Generate Digital ID
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-900/50 bg-red-950/20 p-5">
          <p className="font-semibold text-red-400">
            QR Generation Failed
          </p>

          <p className="mt-2 text-sm text-red-300">
            {error}
          </p>
        </div>
      )}

      {/* Card */}
      {qrCredential ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-6">
            <h2 className="font-semibold">
              Digital Student ID
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              This card contains the student's secure entry QR.
            </p>
          </div>

          <DigitalIdCard
            student={student}
            qrCredential={qrCredential}
          />

          {/* Security notice */}
          <div className="mt-6 rounded-xl border border-amber-900/40 bg-amber-950/10 p-4">
            <p className="text-sm font-medium text-amber-400">
              QR Credential Generated
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              This credential is only available during this
              generation session. The database stores only its
              cryptographic hash.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
          <CreditCard
            size={42}
            className="mx-auto text-slate-700"
          />

          <h2 className="mt-4 text-lg font-semibold">
            Digital ID not generated
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Generate a secure QR credential to create this
            student's digital entry card.
          </p>

          {student.status !== "ACTIVE" && (
            <p className="mt-4 text-xs text-red-400">
              This student is inactive and cannot receive an
              entry credential.
            </p>
          )}
        </div>
      )}
    </div>
  );
}