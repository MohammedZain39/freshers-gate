"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

type Student = {
  id: string;
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
};

export default function DigitalIdCard({
  student,
  qrCredential,
}: {
  student: Student;
  qrCredential: string;
}) {
  const qrCanvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!qrCanvas.current || !qrCredential) return;

    /*
     * IMPORTANT:
     *
     * qrCredential is the original random credential.
     * We do NOT put the SHA-256 hash into the QR.
     *
     * The QR contains a verification URL instead.
     *
     * Example:
     * https://freshers-gate.vercel.app/v/abc123...
     */

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      window.location.origin;

    const verificationUrl =
      `${baseUrl}/v/${encodeURIComponent(qrCredential)}`;

    QRCode.toCanvas(
      qrCanvas.current,
      verificationUrl,
      {
        width: 170,
        margin: 1,
        errorCorrectionLevel: "H",
      },
      (error: Error | null | undefined) => {
        if (error) {
          console.error("QR rendering error:", error);
        }
      }
    );
  }, [qrCredential]);

  return (
    <div
      id="digital-id-card"
      className="relative mx-auto aspect-[1.586/1] w-full max-w-[680px] overflow-hidden rounded-[28px] border border-slate-700 bg-slate-950 p-7 text-white shadow-2xl"
    >
      {/* Background decoration */}
      <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-white/[0.04] blur-3xl" />

      <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-slate-500/[0.06] blur-3xl" />

      <div className="relative flex h-full flex-col">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Narsimha Reddy
            </p>

            <h2 className="mt-1 text-xl font-black tracking-tight">
              ENGINEERING COLLEGE
            </h2>
          </div>

          <div className="rounded-lg border border-slate-700 px-3 py-1.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Freshers
            </p>

            <p className="text-sm font-black">
              2K26
            </p>
          </div>
        </div>

        {/* Main */}
        <div className="flex flex-1 items-center gap-7 py-5">

          {/* Student placeholder */}
          <div className="flex h-40 w-32 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900">
            <span className="text-xs text-slate-600">
              PHOTO
            </span>
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">

            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Student
            </p>

            <p className="mt-1 truncate text-2xl font-black">
              {student.studentName}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
              <Detail
                label="Roll Number"
                value={student.rollNo}
              />

              <Detail
                label="Year"
                value={`${student.year}${
                  student.year === 1 ? "st" : "nd"
                } Year`}
              />

              <Detail
                label="Branch"
                value={student.branch}
              />

              <Detail
                label="Program"
                value={student.program}
              />
            </div>
          </div>

          {/* QR */}
          <div className="shrink-0 rounded-2xl bg-white p-3">
            <canvas
              ref={qrCanvas}
              className="block"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4">

          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Student Entry Pass
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Present this card at the Freshers Gate.
            </p>
          </div>

          <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-400">
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}