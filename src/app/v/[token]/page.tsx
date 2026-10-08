"use client";

import { useEffect, useState } from "react";

type VerificationResult = {
  success: boolean;
  status: string;
  title: string;
  subtitle?: string;
  message: string;
  student?: {
    name: string;
    rollNo: string;
    program: string;
    branch: string;
    year: number;
  };
  enteredAtIST?: string;
};

function getStatusStyle(status: string) {
  switch (status) {
    case "ALLOWED":
      return {
        icon: "✓",
        container: "border-emerald-500/30 bg-emerald-500/10",
        iconBox: "bg-emerald-500/15 text-emerald-400",
        title: "text-emerald-400",
      };

    case "ALREADY_SCANNED":
      return {
        icon: "✓",
        container: "border-blue-500/30 bg-blue-500/10",
        iconBox: "bg-blue-500/15 text-blue-400",
        title: "text-blue-400",
      };

    case "ENTRY_CLOSED":
      return {
        icon: "⏸",
        container: "border-amber-500/30 bg-amber-500/10",
        iconBox: "bg-amber-500/15 text-amber-400",
        title: "text-amber-400",
      };

    default:
      return {
        icon: "!",
        container: "border-red-500/30 bg-red-500/10",
        iconBox: "bg-red-500/15 text-red-400",
        title: "text-red-400",
      };
  }
}

function getYearLabel(year: number) {
  if (year === 1) return "1st Year";
  if (year === 2) return "2nd Year";
  if (year === 3) return "3rd Year";

  return `${year}th Year`;
}

export default function VerificationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      try {
        const { token } = await params;

        if (!token || token.length < 20) {
          if (!cancelled) {
            setResult({
              success: false,
              status: "INVALID_QR",
              title: "INVALID QR",
              subtitle: "QR NOT VALID",
              message:
                "This QR code is invalid or incomplete. Please use the student's official Freshers Gate ID card.",
            });
          }

          return;
        }

        const response = await fetch(
          `/api/verify/${encodeURIComponent(token)}`,
          {
            method: "GET",
            cache: "no-store",
            headers: {
              Accept: "application/json",
            },
          }
        );

        let data: VerificationResult;

        try {
          data = await response.json();
        } catch {
          data = {
            success: false,
            status: "SERVER_ERROR",
            title: "VERIFICATION ERROR",
            subtitle: "TRY AGAIN",
            message:
              "Freshers Gate could not process the verification request.",
          };
        }

        if (!cancelled) {
          setResult(data);
        }
      } catch (error) {
        console.error("Verification page error:", error);

        if (!cancelled) {
          setResult({
            success: false,
            status: "SERVER_ERROR",
            title: "VERIFICATION ERROR",
            subtitle: "CONNECTION FAILED",
            message:
              "Unable to connect to Freshers Gate. Please check your internet connection and try again.",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-500/20 bg-blue-500/10">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />
          </div>

          <h1 className="mt-6 text-xl font-bold">
            Verifying Entry
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Checking this QR code with Freshers Gate...
          </p>

          <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-blue-500" />
          </div>
        </div>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <p className="text-sm text-slate-400">
          Unable to display verification result.
        </p>
      </main>
    );
  }

  const style = getStatusStyle(result.status);

  const isAllowed = result.status === "ALLOWED";
  const isAlreadyScanned = result.status === "ALREADY_SCANNED";
  const isClosed = result.status === "ENTRY_CLOSED";

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">

        {/* Branding */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 shadow-lg shadow-blue-950/20">
            <span className="text-xl font-black tracking-tight text-blue-400">
              FG
            </span>
          </div>

          <h1 className="mt-4 text-xl font-bold tracking-tight">
            Freshers Gate
          </h1>

          <p className="mt-1 text-xs text-slate-500">
            Student Entry Verification
          </p>
        </div>

        {/* Verification Result */}
        <section
          className={`rounded-3xl border p-5 shadow-2xl shadow-black/30 sm:p-6 ${style.container}`}
        >
          {/* Status */}
          <div className="text-center">
            <div
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl font-black ${style.iconBox}`}
            >
              {style.icon}
            </div>

            <p
              className={`mt-5 text-[11px] font-bold tracking-[0.25em] ${style.title}`}
            >
              {result.title}
            </p>

            {result.subtitle && (
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                {result.subtitle}
              </h2>
            )}

            {!result.subtitle && (
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                {result.title}
              </h2>
            )}

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-300">
              {result.message}
            </p>
          </div>

          {/* Allowed Banner */}
          {isAllowed && (
            <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Entry Authorized
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                Student may enter the event.
              </p>
            </div>
          )}

          {/* Already Scanned Banner */}
          {isAlreadyScanned && (
            <div className="mt-6 rounded-2xl border border-blue-400/20 bg-blue-400/5 px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-400">
                Entry Already Recorded
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                This QR code has already been used for entry.
              </p>
            </div>
          )}

          {/* Closed Banner */}
          {isClosed && (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-center">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Entry Currently Closed
              </p>

              <p className="mt-1 text-[11px] text-slate-400">
                Please wait for the entry desk to reopen access.
              </p>
            </div>
          )}

          {/* Student Details */}
          {result.student && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              <div className="border-b border-white/10 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Student
                </p>

                <p className="mt-1 text-base font-bold">
                  {result.student.name}
                </p>
              </div>

              <div className="grid grid-cols-2 divide-x divide-white/10">
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Roll Number
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {result.student.rollNo}
                  </p>
                </div>

                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Year
                  </p>

                  <p className="mt-1 text-sm font-semibold">
                    {getYearLabel(result.student.year)}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/10 px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Branch
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {result.student.branch}
                </p>
              </div>
            </div>
          )}

          {/* First Entry Timestamp */}
          {result.enteredAtIST && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                First Entry Recorded
              </p>

              <p className="mt-2 text-sm font-semibold text-white">
                {result.enteredAtIST}
              </p>

              <p className="mt-1 text-[10px] text-slate-500">
                Server recorded time · IST
              </p>
            </div>
          )}
        </section>

        {/* Security Notice */}
        <div className="mt-5 flex items-center justify-center gap-2 text-center">
          <span className="text-[11px] text-slate-600">
            🔒 Secure QR Verification
          </span>
        </div>

        {/* Footer */}
        <p className="mt-3 text-center text-[10px] text-slate-700">
          Freshers 2K26 · Narsimha Reddy Engineering College
        </p>
      </div>
    </main>
  );
}