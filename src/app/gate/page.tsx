"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  bootstrapGateDatabase,
} from "@/lib/offline/bootstrap";

import {
  getLocalStudentCount,
} from "@/lib/offline/status";

import {
  verifyGateQr,
  type GateVerificationResult,
} from "@/lib/gate/verify";

import {
  syncPendingScans,
} from "@/lib/offline/sync";

import {
  clearLocalGateSession,
  getLocalGateSession,
  type LocalGateSession,
} from "@/lib/offline/session";

type ScannerState =
  | "IDLE"
  | "SCANNING"
  | "RESULT";

export default function GatePage() {
  const scannerRef =
    useRef<any>(null);

  const processingRef =
    useRef(false);

  // false initially.
  // We only mark ONLINE after the server
  // actually responds successfully.
  const [online, setOnline] =
    useState(false);

  const [studentCount, setStudentCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [scannerState, setScannerState] =
    useState<ScannerState>("IDLE");

  const [result, setResult] =
    useState<GateVerificationResult | null>(
      null
    );

  const [message, setMessage] =
    useState("");

  const [gateSession, setGateSession] =
    useState<LocalGateSession | null>(null);

  // =============================================
  // CONNECTION EVENTS
  // =============================================

  useEffect(() => {
    const handleOnline = () => {
  // Do NOT immediately setOnline(true).
  // navigator.onLine only means the device has a
  // network connection. It does NOT prove that our
  // Freshers Gate server is reachable.

  // initializeGate() will:
  //   - set ONLINE if the server responds
  //   - set OFFLINE if the server cannot be reached
  void initializeGate();
};

    const handleOffline = () => {
      setOnline(false);

      // Immediately use the local database.
      void initializeOfflineGate();
    };

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);

  // =============================================
  // OFFLINE DATABASE
  // =============================================

  async function initializeOfflineGate() {
    try {
      setOnline(false);

      const count =
        await getLocalStudentCount();

      setStudentCount(count);

      if (count > 0) {
        setMessage(
          `Offline database ready with ${count.toLocaleString()} students.`
        );
      } else {
        setMessage(
          "No offline database available. Connect to the internet and initialize the gate first."
        );
      }
    } catch (error) {
      console.error(
        "Offline gate initialization error:",
        error
      );

      setStudentCount(0);

      setMessage(
        "Unable to access the offline gate database."
      );
    } finally {
      setLoading(false);
    }
  }

  // =============================================
  // SERVER + DATABASE INITIALIZATION
  // =============================================

  async function initializeGate() {
  try {
    setLoading(true);
    setMessage("");

    // Until the server successfully responds,
    // consider the gate offline.
    setOnline(false);

      // -----------------------------------------
      // IMPORTANT:
      // Do NOT rely only on navigator.onLine.
      //
      // navigator.onLine can say "true" even when
      // the actual server cannot be reached.
      //
      // We actually try the server.
      // -----------------------------------------

      try {
        const data =
          await bootstrapGateDatabase();

        // Server successfully responded.
        setOnline(true);

        const count =
          data.count ??
          data.students?.length ??
          0;

        setStudentCount(count);

        if (count > 0) {
          setMessage(
            `Gate database ready with ${count.toLocaleString()} students.`
          );
        } else {
          setMessage(
            "Gate database is empty."
          );
        }

        // Save local session if bootstrap returned it.
        if (data.scanner) {
          const session: LocalGateSession = {
            id: data.scanner.id,
            name: data.scanner.name,
            role: data.scanner.role,
            authenticatedAt:
              new Date().toISOString(),
          };

          setGateSession(session);
        }

        // Try syncing any pending offline scans.
        void syncPendingScans();

        return;
      } catch (serverError) {
        console.warn(
          "Freshers Gate server unavailable. Switching to offline database.",
          serverError
        );
      }

      // -----------------------------------------
      // SERVER FAILED
      // -----------------------------------------

      setOnline(false);

      const localCount =
        await getLocalStudentCount();

      setStudentCount(localCount);

      if (localCount > 0) {
        setMessage(
          `Offline database ready with ${localCount.toLocaleString()} students.`
        );
      } else {
        setMessage(
          "No offline database available. Connect to the internet and initialize the gate first."
        );
      }
    } catch (error) {
      console.error(
        "Gate initialization error:",
        error
      );

      setOnline(false);

      try {
        const localCount =
          await getLocalStudentCount();

        setStudentCount(localCount);

        setMessage(
          localCount > 0
            ? `Offline database ready with ${localCount.toLocaleString()} students.`
            : "Unable to initialize gate database."
        );
      } catch {
        setStudentCount(0);

        setMessage(
          "Unable to initialize gate database."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  // =============================================
  // INITIAL PAGE LOAD
  // =============================================

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const localSession =
          await getLocalGateSession();

        if (!cancelled) {
          setGateSession(localSession);
        }
      } catch (error) {
        console.warn(
          "Unable to load local gate session:",
          error
        );
      }

      if (!cancelled) {
        await initializeGate();
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  // =============================================
  // PERIODIC SYNC
  // =============================================

  useEffect(() => {
    const interval =
      window.setInterval(() => {
        if (online) {
  void syncPendingScans();
}
      }, 10000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  // =============================================
  // START CAMERA
  // =============================================

  async function startScanner() {
    if (processingRef.current) {
      return;
    }

    if (studentCount <= 0) {
      setMessage(
        "Gate database is not ready."
      );
      return;
    }

    try {
      setResult(null);
      setMessage("");

      processingRef.current = false;

      setScannerState("SCANNING");

      const {
        Html5Qrcode,
      } = await import(
        "html5-qrcode"
      );

      const scanner =
        new Html5Qrcode(
          "freshers-gate-reader"
        );

      scannerRef.current = scanner;

      await scanner.start(
        {
          facingMode: "environment",
        },
        {
          fps: 15,

          qrbox: {
            width: 260,
            height: 260,
          },

          aspectRatio: 1,
        },

        // =======================================
        // QR FOUND
        // =======================================

        async (
          decodedText: string
        ) => {
          // html5-qrcode can fire this callback
          // repeatedly for the same QR.
          if (processingRef.current) {
            return;
          }

          processingRef.current = true;

          try {
            // Stop camera immediately.
            try {
              await scanner.stop();
            } catch {
              // Camera may already be stopped.
            }

            scannerRef.current = null;

            setScannerState("RESULT");

            // -----------------------------------
            // VERIFY QR
            // -----------------------------------

            const verification =
              await verifyGateQr(
                decodedText
              );

            setResult(
              verification
            );
          } catch (error) {
            console.error(
              "Gate scan error:",
              error
            );

            setResult({
              success: false,

              source: navigator.onLine
                ? "ONLINE"
                : "OFFLINE",

              status:
                "SERVER_ERROR",

              title:
                "VERIFICATION ERROR",

              subtitle:
                "PLEASE TRY AGAIN",

              message:
                "Unable to process this QR code.",
            });

            setScannerState(
              "RESULT"
            );
          }
        },

        // =======================================
        // QR NOT FOUND
        // =======================================

        () => {
          // Ignore continuous camera
          // "QR not found" messages.
        }
      );
    } catch (error) {
      console.error(
        "Camera start error:",
        error
      );

      setScannerState("IDLE");

      setMessage(
        "Unable to start camera. Please allow camera permission."
      );
    }
  }

  // =============================================
  // RESET SCANNER
  // =============================================

  function resetScanner() {
    processingRef.current = false;

    setResult(null);

    setMessage("");

    setScannerState("IDLE");

    if (online) {
  void syncPendingScans();
}
  }

  // =============================================
  // CAMERA CLEANUP
  // =============================================

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {});

        scannerRef.current = null;
      }
    };
  }, []);

  // =============================================
  // LOGOUT
  // =============================================

  async function handleLogout() {
    try {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          // Ignore camera cleanup errors.
        }

        scannerRef.current = null;
      }

      await clearLocalGateSession();

      if (navigator.onLine) {
        try {
          await fetch(
            "/api/auth/logout",
            {
              method: "POST",
              credentials: "include",
            }
          );
        } catch {
          // Server logout can fail while
          // offline. Local session is already
          // cleared.
        }
      }

      window.location.href =
        "/login";
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      window.location.href =
        "/login";
    }
  }

  // =============================================
  // RESULT SCREEN
  // =============================================

  if (
    scannerState === "RESULT" &&
    result
  ) {
    const allowed =
      result.status ===
      "ALLOWED";

    const already =
      result.status ===
      "ALREADY_SCANNED";

    const closed =
      result.status ===
      "ENTRY_CLOSED";

    return (
      <main className="min-h-screen bg-slate-950 px-5 py-6 text-white">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">

          {/* Branding */}

          <div className="mb-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <span className="text-xl font-black text-blue-400">
                FG
              </span>
            </div>

            <h1 className="mt-4 text-xl font-bold">
              Freshers Gate
            </h1>

            <p className="mt-1 text-xs text-slate-500">
              Gate Verification
            </p>
          </div>

          {/* Result Card */}

          <div
            className={`rounded-3xl border p-6 text-center ${
              allowed
                ? "border-emerald-500/30 bg-emerald-500/10"
                : already
                  ? "border-blue-500/30 bg-blue-500/10"
                  : closed
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-red-500/30 bg-red-500/10"
            }`}
          >

            {/* Result Icon */}

            <div
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-4xl font-black ${
                allowed
                  ? "bg-emerald-500/15 text-emerald-400"
                  : already
                    ? "bg-blue-500/15 text-blue-400"
                    : closed
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-red-500/15 text-red-400"
              }`}
            >
              {allowed
                ? "✓"
                : already
                  ? "✓"
                  : closed
                    ? "⏸"
                    : "!"}
            </div>

            {/* Source */}

            <p className="mt-5 text-xs font-bold tracking-[0.2em] text-slate-400">
              {result.source ===
              "OFFLINE"
                ? "OFFLINE VERIFICATION"
                : "ONLINE VERIFICATION"}
            </p>

            {/* Title */}

            <h2 className="mt-3 text-3xl font-black">
              {result.title}
            </h2>

            {/* Subtitle */}

            {result.subtitle && (
              <p className="mt-2 text-sm font-bold tracking-wide text-slate-300">
                {result.subtitle}
              </p>
            )}

            {/* Message */}

            <p className="mt-4 text-sm leading-6 text-slate-300">
              {result.message}
            </p>

            {/* Student */}

            {result.student && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 text-left">

                <div className="border-b border-white/10 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Student
                  </p>

                  <p className="mt-1 font-bold">
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
                      {result.student.year ===
                      1
                        ? "1st Year"
                        : "2nd Year"}
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

            {/* Timestamp */}

            {result.enteredAtIST && (
              <p className="mt-4 text-xs text-slate-500">
                {result.enteredAtIST}
              </p>
            )}

          </div>

          {/* Next Scan */}

          <button
            onClick={
              resetScanner
            }
            className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-400"
          >
            Scan Next Student
          </button>

          {/* Connection */}

          <div className="mt-4 text-center">
            <span
              className={`text-xs font-semibold ${
                online
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              ●{" "}
              {online
                ? "Online"
                : "Offline Mode"}
            </span>
          </div>

          {/* Logout */}

          <button
            onClick={
              handleLogout
            }
            className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            Logout
          </button>

        </div>
      </main>
    );
  }

  // =============================================
  // MAIN GATE SCREEN
  // =============================================

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md flex-col justify-center">

        {/* Branding */}

        <div className="text-center">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-blue-500/20 bg-blue-500/10">
            <span className="text-2xl font-black text-blue-400">
              FG
            </span>
          </div>

          <h1 className="mt-5 text-2xl font-black">
            Freshers Gate
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Student Entry Verification
          </p>

          {gateSession && (
            <p className="mt-2 text-xs text-slate-600">
              Scanner:{" "}
              {gateSession.name}
            </p>
          )}

        </div>

        {/* Connection Card */}

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <span
                className={`h-3 w-3 rounded-full ${
                  online
                    ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]"
                    : "bg-amber-400"
                }`}
              />

              <div>

                <p className="text-sm font-semibold">
                  {online
                    ? "ONLINE"
                    : "OFFLINE"}
                </p>

                <p className="text-xs text-slate-500">
                  {online
                    ? "Server verification available"
                    : "Local verification active"}
                </p>

              </div>

            </div>

            <span className="text-xs font-semibold text-slate-400">
              {studentCount.toLocaleString()}{" "}
              students
            </span>

          </div>

        </div>

        {/* Scanner */}

        <div className="mt-4 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50">

          <div
            id="freshers-gate-reader"
            className="min-h-[320px] w-full"
          />

          {scannerState !==
            "SCANNING" && (
            <div className="px-5 py-8 text-center">

              {loading ? (
                <>
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-blue-500" />

                  <p className="mt-4 text-sm text-slate-300">
                    Preparing gate...
                  </p>
                </>
              ) : studentCount >
                0 ? (
                <>
                  <p className="text-lg font-bold">
                    Ready to Scan
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Scan the QR code on the
                    student's Digital ID.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-red-400">
                    Gate database unavailable
                  </p>

                  <p className="mt-2 text-xs text-slate-500">
                    Connect to the internet and
                    initialize the gate.
                  </p>
                </>
              )}

            </div>
          )}

          {scannerState ===
            "SCANNING" && (
            <div className="border-t border-slate-800 px-5 py-4 text-center">

              <p className="text-sm font-semibold text-blue-400">
                Point camera at QR code
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Verification will happen
                automatically.
              </p>

            </div>
          )}

        </div>

        {/* Message */}

        {message && (
          <p className="mt-4 text-center text-xs text-slate-500">
            {message}
          </p>
        )}

        {/* Start Scanner */}

        <button
          onClick={
            startScanner
          }
          disabled={
            loading ||
            studentCount === 0 ||
            scannerState ===
              "SCANNING"
          }
          className="mt-5 w-full rounded-2xl bg-blue-500 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {scannerState ===
          "SCANNING"
            ? "Scanner Active..."
            : "Start QR Scanner"}
        </button>

        {/* Refresh Database */}

        <button
          onClick={
            initializeGate
          }
          disabled={loading}
          className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-50"
        >
          {loading
            ? "Please wait..."
            : "Refresh Database"}
        </button>

        {/* Connection Status */}

        <div className="mt-5 text-center">

          <span
            className={`text-xs font-semibold ${
              online
                ? "text-emerald-400"
                : "text-amber-400"
            }`}
          >
            ●{" "}
            {online
              ? "ONLINE"
              : "OFFLINE MODE"}
          </span>

        </div>

        {/* Logout */}

        <button
          onClick={
            handleLogout
          }
          className="mt-4 w-full rounded-2xl border border-slate-800 bg-slate-900 px-5 py-3 text-xs font-semibold text-slate-500 transition hover:bg-slate-800 hover:text-white"
        >
          Logout
        </button>

        <p className="mt-4 text-center text-[10px] text-slate-700">
          Freshers 2K26 · Secure Gate Verification
        </p>

      </div>
    </main>
  );
}