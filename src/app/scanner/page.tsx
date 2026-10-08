"use client";

import {

  useCallback,

  useEffect,

  useRef,

  useState,

} from "react";

import {

  AlertCircle,

  CheckCircle2,

  Database,

  Loader2,

  RefreshCw,

  ScanLine,

  SwitchCamera,

  Wifi,

  WifiOff,

  XCircle,

} from "lucide-react";

import {

  getCachedStudentCount,

  getPendingEntryCount,

} from "@/lib/scanner/db";

import { getLastSyncTime } from "@/lib/scanner/sync";

import { getDeviceId } from "@/lib/scanner/device";

import { verifyQrLocally } from "@/lib/scanner/verify";

type Student = {

  id: string;

  rollNo: string;

  studentName: string;

  program: string;

  branch: string;

  year: number;

  status: "ACTIVE" | "INACTIVE";

};

type ScanResult =

  | {

      result: "ALLOWED";

      reason: null;

      student: Student;

    }

  | {

      result: "DENIED";

      reason: string;

      student: Student | null;

    }

  | {

      result: "ALREADY_ENTERED";

      reason: string;

      student: Student;

    };

type ScannerStatus =

  | "READY"

  | "SCANNING"

  | "PROCESSING"

  | "ALLOWED"

  | "DENIED"

  | "ALREADY_ENTERED"

  | "ERROR";

type CameraDevice = {

  id: string;

  label: string;

};

export default function ScannerPage() {

  const scannerRef =

    useRef<

      import("html5-qrcode").Html5Qrcode | null

    >(null);

  /*

   * HARD SCAN LOCK

   *

   * Once one QR is detected, this remains true

   * until the operator explicitly clicks

   * "Scan Next Student".

   */

  const processingRef = useRef(false);

  const mountedRef = useRef(true);

  const [deviceId, setDeviceId] = useState("");

  const [cachedStudents, setCachedStudents] =

    useState(0);

  const [pendingEntries, setPendingEntries] =

    useState(0);

  const [lastSync, setLastSync] =

    useState<string | null>(null);

  const [online, setOnline] =

    useState(true);

  const [cameraReady, setCameraReady] =

    useState(false);

  const [cameraDevices, setCameraDevices] =

    useState<CameraDevice[]>([]);

  const [selectedCamera, setSelectedCamera] =

    useState("");

  const [scannerStatus, setScannerStatus] =

    useState<ScannerStatus>("READY");

  const [scanResult, setScanResult] =

    useState<ScanResult | null>(null);

  const [errorMessage, setErrorMessage] =

    useState("");

  /*

   * ============================================================

   * LOAD LOCAL STATE

   * ============================================================

   */

  const loadLocalState =

    useCallback(async () => {

      try {

        const [

          id,

          studentCount,

          pendingCount,

          syncTime,

        ] = await Promise.all([

          getDeviceId(),

          getCachedStudentCount(),

          getPendingEntryCount(),

          getLastSyncTime(),

        ]);

        if (!mountedRef.current) {

          return;

        }

        setDeviceId(id);

        setCachedStudents(studentCount);

        setPendingEntries(pendingCount);

        setLastSync(syncTime);

      } catch (error) {

        console.error(

          "Failed to load scanner state:",

          error

        );

      }

    }, []);

  /*

   * ============================================================

   * ONLINE / OFFLINE STATUS

   * ============================================================

   */

  useEffect(() => {

    mountedRef.current = true;

    setOnline(navigator.onLine);

    void loadLocalState();

    const handleOnline = () => {

      setOnline(true);

    };

    const handleOffline = () => {

      setOnline(false);

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

      mountedRef.current = false;

      window.removeEventListener(

        "online",

        handleOnline

      );

      window.removeEventListener(

        "offline",

        handleOffline

      );

    };

  }, [loadLocalState]);

  /*

   * ============================================================

   * CAMERA DISCOVERY

   * ============================================================

   */

  const loadCameras =

    useCallback(async () => {

      try {

        const module = await import(

          "html5-qrcode"

        );

        const cameras =

          await module.Html5Qrcode.getCameras();

        const devices: CameraDevice[] =

          cameras.map((camera) => ({

            id: camera.id,

            label:

              camera.label || "Camera",

          }));

        setCameraDevices(devices);

        if (devices.length === 0) {

          throw new Error(

            "No camera was detected on this device."

          );

        }

        const rearCamera =

          devices.find((camera) => {

            const label =

              camera.label.toLowerCase();

            return (

              label.includes("back") ||

              label.includes("rear") ||

              label.includes("environment") ||

              label.includes("world")

            );

          });

        const preferredCamera =

          rearCamera ?? devices[0];

        setSelectedCamera(

          preferredCamera.id

        );

        return devices;

      } catch (error) {

        console.error(

          "Camera discovery failed:",

          error

        );

        throw error;

      }

    }, []);

  /*

   * ============================================================

   * STOP SCANNER

   * ============================================================

   */

  const stopScanner =

    useCallback(async () => {

      const scanner =

        scannerRef.current;

      if (!scanner) {

        setCameraReady(false);

        return;

      }

      try {

        await scanner.stop();

      } catch {

        // Scanner may already be stopped.

      }

      try {

        scanner.clear();

      } catch {

        // Ignore cleanup errors.

      }

      scannerRef.current = null;

      setCameraReady(false);

    }, []);

  /*

   * ============================================================

   * START QR SCANNER

   * ============================================================

   */

  const startScanner =

    useCallback(

      async (cameraId?: string) => {

        if (cachedStudents === 0) {

          setScannerStatus("ERROR");

          setErrorMessage(

            "No student data is cached on this device. Synchronize the scanner first."

          );

          return;

        }

        /*

         * Never start another scanner while a scan

         * is already being processed.

         */

        if (processingRef.current) {

          return;

        }

        try {

          setErrorMessage("");

          setScanResult(null);

          setScannerStatus("SCANNING");

          const module = await import(

            "html5-qrcode"

          );

          const Html5Qrcode =

            module.Html5Qrcode;

          let activeCamera =

            cameraId || selectedCamera;

          if (!activeCamera) {

            const devices =

              await loadCameras();

            activeCamera =

              devices[0]?.id;

          }

          if (!activeCamera) {

            throw new Error(

              "No usable camera was found."

            );

          }

          const scanner =

            new Html5Qrcode(

              "freshers-gate-reader"

            );

          scannerRef.current =

            scanner;

          await scanner.start(

            activeCamera,

            {

              fps: 15,

              qrbox: {

                width: 300,

                height: 300,

              },

              aspectRatio: 1,

              disableFlip: true,

            },

            /*

             * ==================================================

             * QR DETECTED

             * ==================================================

             */

            async (

              decodedText: string

            ) => {

              /*

               * HARD LOCK IMMEDIATELY.

               *

               * html5-qrcode can have multiple

               * callbacks queued before stop()

               * completely settles.

               *

               * Therefore this must happen BEFORE

               * any await.

               */

              if (processingRef.current) {

                return;

              }

              processingRef.current = true;

              setScannerStatus(

                "PROCESSING"

              );

              try {

                /*

                 * ==================================================

                 * STOP CAMERA IMMEDIATELY

                 * ==================================================

                 */

                const activeScanner =

                  scannerRef.current;

                if (activeScanner) {

                  try {

                    await activeScanner.stop();

                  } catch {

                    // Already stopped.

                  }

                  try {

                    activeScanner.clear();

                  } catch {

                    // Ignore cleanup errors.

                  }

                  scannerRef.current =

                    null;

                }

                setCameraReady(false);

                /*

                 * ==================================================

                 * VERIFY EXACTLY ONCE

                 * ==================================================

                 */

                console.log(
                  "🔥 VERIFY CALLED",
                  new Date().toISOString(),
                  decodedText
                );

                const result =
                  await verifyQrLocally(decodedText);

                console.log(
                  "🔥 VERIFY RESULT",
                  new Date().toISOString(),
                  result.result,
                  result.student?.rollNo
                );

                if (

                  !mountedRef.current

                ) {

                  return;

                }

                /*

                 * ==================================================

                 * SET RESULT

                 * ==================================================

                 */

                setScanResult(result);

                if (

                  result.result ===

                  "ALLOWED"

                ) {

                  setScannerStatus(

                    "ALLOWED"

                  );

                } else if (

                  result.result ===

                  "ALREADY_ENTERED"

                ) {

                  setScannerStatus(

                    "ALREADY_ENTERED"

                  );

                } else {

                  setScannerStatus(

                    "DENIED"

                  );

                }

                /*

                 * Update counters only.

                 *

                 * IMPORTANT:

                 * loadLocalState() does NOT touch

                 * scanResult or scannerStatus.

                 */

                await loadLocalState();

                /*

                 * DO NOT SET

                 *

                 * processingRef.current = false

                 *

                 * here.

                 *

                 * The lock remains active while the

                 * result screen is displayed.

                 */

              } catch (error) {

  console.error(

    "Local QR verification failed:",

    error

  );

  setScannerStatus("ERROR");

  setErrorMessage(

    "Unable to verify this QR code."

  );

  /*

   * IMPORTANT:

   * DO NOT unlock here.

   *

   * The scanner remains locked until

   * the operator clicks "Scan Next Student".

   */

}
            },

            /*

             * QR not detected in this frame.

             */

            () => {

              // Intentionally do nothing.

            }

          );

          if (

            !mountedRef.current

          ) {

            return;

          }

          setSelectedCamera(

            activeCamera

          );

          setCameraReady(true);

        } catch (error) {

          console.error(

            "Camera scanner error:",

            error

          );

          scannerRef.current =

            null;

          setCameraReady(false);

          setScannerStatus("ERROR");

          setErrorMessage(

            getCameraErrorMessage(

              error

            )

          );

        }

      },

      [

        cachedStudents,

        loadCameras,

        loadLocalState,

        selectedCamera,

      ]

    );

  /*

   * ============================================================

   * CLEANUP

   * ============================================================

   */

  useEffect(() => {

    return () => {

      const scanner =

        scannerRef.current;

      if (scanner) {

        scanner

          .stop()

          .catch(() => {});

        try {

          scanner.clear();

        } catch {

          // Ignore cleanup errors.

        }

      }

      scannerRef.current = null;

    };

  }, []);

  /*

   * ============================================================

   * START INITIAL SCANNER

   * ============================================================

   */

  async function startInitialScanner() {

    /*

     * Don't start another scan while

     * current result is locked.

     */

    if (processingRef.current) {

      return;

    }

    try {

      if (

        !navigator.mediaDevices ||

        !navigator.mediaDevices.getUserMedia

      ) {

        throw new Error(

          "Camera access is not available in this browser."

        );

      }

      await navigator.mediaDevices.getUserMedia(

        {

          video: {

            facingMode: {

              ideal: "environment",

            },

            width: {

              ideal: 1920,

            },

            height: {

              ideal: 1080,

            },

          },

          audio: false,

        }

      );

      await loadCameras();

      await startScanner();

    } catch (error) {

      console.error(error);

      setScannerStatus("ERROR");

      setErrorMessage(

        getCameraErrorMessage(

          error

        )

      );

    }

  }

  /*

   * ============================================================

   * SWITCH CAMERA

   * ============================================================

   */

  async function switchCamera() {

    if (cameraDevices.length < 2) {

      return;

    }

    /*

     * Never switch while processing a QR.

     */

    if (processingRef.current) {

      return;

    }

    const currentIndex =

      cameraDevices.findIndex(

        (camera) =>

          camera.id ===

          selectedCamera

      );

    const nextIndex =

      currentIndex >= 0

        ? (currentIndex + 1) %

          cameraDevices.length

        : 0;

    const nextCamera =

      cameraDevices[nextIndex];

    if (!nextCamera) {

      return;

    }

    await stopScanner();

    await startScanner(

      nextCamera.id

    );

  }

  /*

   * ============================================================

   * RESET SCANNER

   * ============================================================

   */

  async function resetScanner() {

    await stopScanner();

    /*

     * Unlock ONLY when the operator

     * explicitly resets the scanner.

     */

    processingRef.current = false;

    setScanResult(null);

    setErrorMessage("");

    setScannerStatus("READY");

  }

  /*

   * ============================================================

   * SCAN NEXT STUDENT

   * ============================================================

   */

  async function scanAgain() {

    /*

     * Reset first.

     */

    await resetScanner();

    /*

     * resetScanner() already unlocked it.

     */

    await startInitialScanner();

  }

  const selectedCameraLabel =

    cameraDevices.find(

      (camera) =>

        camera.id ===

        selectedCamera

    )?.label;

  /*

   * ============================================================

   * UI

   * ============================================================

   */

  return (

    <div className="min-h-[calc(100vh-2rem)]">

      {/* HEADER */}

      <div className="mb-5 flex flex-col gap-4">

        <div className="flex items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3">

              <ScanLine className="h-6 w-6 text-cyan-400" />

            </div>

            <div>

              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-cyan-400">

                FRESHERS GATE

              </p>

              <h1 className="mt-1 text-2xl font-semibold text-white">

                Gate Scanner

              </h1>

            </div>

          </div>

          <StatusPill

            online={online}

            label={

              online

                ? "ONLINE"

                : "OFFLINE"

            }

          />

        </div>

        <div className="flex flex-wrap gap-2">

          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">

            <Database className="h-4 w-4 text-cyan-400" />

            {cachedStudents} students cached

          </div>

          <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">

            <RefreshCw className="h-4 w-4 text-amber-400" />

            {pendingEntries} pending

          </div>

          {lastSync && (

            <div className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400">

              Last sync: {lastSync}

            </div>

          )}

        </div>

      </div>

      {/* MAIN */}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">

        {/* SCANNER */}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">

          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">

            <div>

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">

                Gate Scanner

              </p>

              <p className="mt-1 text-xs text-slate-500">

                {selectedCameraLabel ||

                  "Camera not selected"}

              </p>

            </div>

            <div className="flex gap-2">

              {cameraDevices.length >= 2 &&

                scannerStatus ===

                  "SCANNING" && (

                  <button

                    type="button"

                    onClick={

                      switchCamera

                    }

                    disabled={

                      processingRef.current

                    }

                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40"

                  >

                    <SwitchCamera className="h-4 w-4" />

                    Switch

                  </button>

                )}

            </div>

          </div>

          <div className="relative min-h-[500px] bg-black">

            {scannerStatus ===

              "READY" && (

              <ScannerEmptyState

                cachedStudents={

                  cachedStudents

                }

                onStart={

                  startInitialScanner

                }

              />

            )}

            {scannerStatus ===

              "SCANNING" && (

              <>

                <div

                  id="freshers-gate-reader"

                  className="min-h-[500px] w-full overflow-hidden"

                />

                <ScannerOverlay />

              </>

            )}

            {scannerStatus ===

              "PROCESSING" && (

              <ProcessingState />

            )}

            {scannerStatus ===

                "ALLOWED" &&

              scanResult?.result ===

                "ALLOWED" && (

                <AllowedState

                  result={

                    scanResult

                  }

                  onScanAgain={

                    scanAgain

                  }

                />

              )}

            {scannerStatus ===

                "ALREADY_ENTERED" &&

              scanResult?.result ===

                "ALREADY_ENTERED" && (

                <AlreadyEnteredState

                  result={

                    scanResult

                  }

                  onScanAgain={

                    scanAgain

                  }

                />

              )}

            {scannerStatus === "DENIED" &&
  scanResult?.result === "DENIED" && (
    <DeniedState
      result={scanResult}
      onScanAgain={scanAgain}
    />
  )}

            {scannerStatus ===

              "ERROR" && (

              <ErrorState

                message={

                  errorMessage

                }

                onRetry={

                  startInitialScanner

                }

                onReset={

                  resetScanner

                }

              />

            )}

          </div>

        </div>

        {/* INFORMATION */}

        <div className="space-y-4">

          <InfoCard

            title="Scanner Device"

            icon={

              <Database className="h-4 w-4 text-cyan-400" />

            }

          >

            <p className="break-all font-mono text-[11px] leading-5 text-slate-400">

              {deviceId ||

                "Loading device ID..."}

            </p>

          </InfoCard>

          <InfoCard

            title="Connection"

            icon={

              online ? (

                <Wifi className="h-4 w-4 text-emerald-400" />

              ) : (

                <WifiOff className="h-4 w-4 text-amber-400" />

              )

            }

          >

            <p className="text-sm text-slate-300">

              {online

                ? "Online"

                : "Offline mode"}

            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">

              QR verification continues

              locally when the network is

              unavailable.

            </p>

          </InfoCard>

          <InfoCard

            title="Scanner Status"

            icon={

              <ScanLine className="h-4 w-4 text-cyan-400" />

            }

          >

            <p className="text-sm font-medium text-white">

              {scannerStatus}

            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">

              One QR is processed at a

              time. Scan the next student

              only after the current result

              is displayed.

            </p>

          </InfoCard>

        </div>

      </div>

    </div>

  );

}

/*

 * ============================================================

 * STATUS PILL

 * ============================================================

 */

function StatusPill({

  online,

  label,

}: {

  online: boolean;

  label: string;

}) {

  return (

    <div

      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] ${

        online

          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400"

          : "border-amber-400/20 bg-amber-400/10 text-amber-400"

      }`}

    >

      <span

        className={`h-1.5 w-1.5 rounded-full ${

          online

            ? "bg-emerald-400"

            : "bg-amber-400"

        }`}

      />

      {label}

    </div>

  );

}

/*

 * ============================================================

 * EMPTY SCANNER

 * ============================================================

 */

function ScannerEmptyState({

  cachedStudents,

  onStart,

}: {

  cachedStudents: number;

  onStart: () => void;

}) {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">

      <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">

        <ScanLine className="h-10 w-10 text-cyan-400" />

      </div>

      <h2 className="text-lg font-semibold text-white">

        Ready to Scan

      </h2>

      <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">

        Scan a student's Digital ID QR

        code to verify their entry.

      </p>

      <p className="mt-2 text-xs text-slate-500">

        {cachedStudents} students available

        on this scanner

      </p>

      <button

        type="button"

        onClick={onStart}

        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"

      >

        <ScanLine className="h-4 w-4" />

        Start Scanner

      </button>

    </div>

  );

}

/*

 * ============================================================

 * SCANNER OVERLAY

 * ============================================================

 */

function ScannerOverlay() {

  return (

    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

      <div className="relative h-[300px] w-[300px]">

        <div className="absolute left-0 top-0 h-10 w-10 border-l-2 border-t-2 border-cyan-400" />

        <div className="absolute right-0 top-0 h-10 w-10 border-r-2 border-t-2 border-cyan-400" />

        <div className="absolute bottom-0 left-0 h-10 w-10 border-b-2 border-l-2 border-cyan-400" />

        <div className="absolute bottom-0 right-0 h-10 w-10 border-b-2 border-r-2 border-cyan-400" />

        <div className="absolute left-0 right-0 top-1/2 h-px bg-cyan-400/70" />

      </div>

      <div className="absolute bottom-8 rounded-full border border-white/10 bg-black/70 px-4 py-2 text-xs text-slate-300 backdrop-blur">

        Align QR code inside the frame

      </div>

    </div>

  );

}

/*

 * ============================================================

 * PROCESSING

 * ============================================================

 */

function ProcessingState() {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center">

      <div className="mb-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-5">

        <Loader2 className="h-10 w-10 animate-spin text-cyan-400" />

      </div>

      <h2 className="text-lg font-semibold text-white">

        Verifying QR

      </h2>

      <p className="mt-2 text-sm text-slate-400">

        Please wait...

      </p>

    </div>

  );

}

/*

 * ============================================================

 * ALLOWED

 * ============================================================

 */

function AllowedState({

  result,

  onScanAgain,

}: {

  result: Extract<

    ScanResult,

    { result: "ALLOWED" }

  >;

  onScanAgain: () => void;

}) {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">

      <div className="mb-5 rounded-full border border-emerald-400/20 bg-emerald-400/10 p-5">

        <CheckCircle2 className="h-12 w-12 text-emerald-400" />

      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">

        ENTRY ALLOWED

      </p>

      <h2 className="mt-2 text-3xl font-bold text-white">

        AUTHORIZED

      </h2>

      <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">

        <p className="text-lg font-semibold text-white">

          {result.student.studentName}

        </p>

        <p className="mt-1 font-mono text-sm text-cyan-400">

          {result.student.rollNo}

        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">

          <div>

            <p className="text-slate-500">

              Program

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.program}

            </p>

          </div>

          <div>

            <p className="text-slate-500">

              Branch

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.branch}

            </p>

          </div>

          <div>

            <p className="text-slate-500">

              Year

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.year}

            </p>

          </div>

          <div>

            <p className="text-slate-500">

              Status

            </p>

            <p className="mt-1 text-emerald-400">

              ACTIVE

            </p>

          </div>

        </div>

      </div>

      <p className="mt-4 text-xs text-slate-500">

        Entry recorded locally

      </p>

      <button

        type="button"

        onClick={onScanAgain}

        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"

      >

        <ScanLine className="h-4 w-4" />

        Scan Next Student

      </button>

    </div>

  );

}

/*

 * ============================================================

 * ALREADY ENTERED

 * ============================================================

 */

function AlreadyEnteredState({

  result,

  onScanAgain,

}: {

  result: Extract<

    ScanResult,

    { result: "ALREADY_ENTERED" }

  >;

  onScanAgain: () => void;

}) {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">

      <div className="mb-5 rounded-full border border-amber-400/20 bg-amber-400/10 p-5">

        <AlertCircle className="h-12 w-12 text-amber-400" />

      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">

        ALREADY SCANNED

      </p>

      <h2 className="mt-2 text-2xl font-bold text-white">

        ENTRY ALREADY RECORDED

      </h2>

      <div className="mt-6 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-left">

        <p className="text-lg font-semibold text-white">

          {result.student.studentName}

        </p>

        <p className="mt-1 font-mono text-sm text-cyan-400">

          {result.student.rollNo}

        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs">

          <div>

            <p className="text-slate-500">

              Program

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.program}

            </p>

          </div>

          <div>

            <p className="text-slate-500">

              Branch

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.branch}

            </p>

          </div>

          <div>

            <p className="text-slate-500">

              Year

            </p>

            <p className="mt-1 text-slate-200">

              {result.student.year}

            </p>

          </div>

        </div>

      </div>

      <button

        type="button"

        onClick={onScanAgain}

        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"

      >

        <ScanLine className="h-4 w-4" />

        Scan Next Student

      </button>

    </div>

  );

}

/*

 * ============================================================

 * DENIED

 * ============================================================

 */

function DeniedState({

  result,

  onScanAgain,

}: {

  result: Extract<

    ScanResult,

    { result: "DENIED" }

  > | null;

  onScanAgain: () => void;

}) {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">

      <div className="mb-5 rounded-full border border-red-400/20 bg-red-400/10 p-5">

        <XCircle className="h-12 w-12 text-red-400" />

      </div>

      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-400">

        ENTRY DENIED

      </p>

      <h2 className="mt-2 text-2xl font-bold text-white">

        NOT AUTHORIZED

      </h2>

      <p className="mt-3 max-w-md text-sm text-slate-400">

        {result?.reason ||

          "This QR code could not be verified."}

      </p>

      {result?.student && (

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-4">

          <p className="font-semibold text-white">

            {result.student.studentName}

          </p>

          <p className="mt-1 font-mono text-sm text-cyan-400">

            {result.student.rollNo}

          </p>

        </div>

      )}

      <button

        type="button"

        onClick={onScanAgain}

        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"

      >

        <ScanLine className="h-4 w-4" />

        Scan Next Student

      </button>

    </div>

  );

}

/*

 * ============================================================

 * ERROR

 * ============================================================

 */

function ErrorState({

  message,

  onRetry,

  onReset,

}: {

  message: string;

  onRetry: () => void;

  onReset: () => void;

}) {

  return (

    <div className="flex min-h-[500px] flex-col items-center justify-center px-6 text-center">

      <div className="mb-5 rounded-full border border-red-400/20 bg-red-400/10 p-5">

        <XCircle className="h-12 w-12 text-red-400" />

      </div>

      <h2 className="text-xl font-semibold text-white">

        Scanner Error

      </h2>

      <p className="mt-2 max-w-md text-sm text-slate-400">

        {message}

      </p>

      <div className="mt-6 flex gap-3">

        <button

          type="button"

          onClick={onReset}

          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-medium text-slate-200 hover:bg-white/[0.08]"

        >

          Reset

        </button>

        <button

          type="button"

          onClick={onRetry}

          className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300"

        >

          <RefreshCw className="h-4 w-4" />

          Retry

        </button>

      </div>

    </div>

  );

}

/*

 * ============================================================

 * INFO CARD

 * ============================================================

 */

function InfoCard({

  title,

  icon,

  children,

}: {

  title: string;

  icon: React.ReactNode;

  children: React.ReactNode;

}) {

  return (

    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">

      <div className="flex items-center gap-2">

        {icon}

        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">

          {title}

        </p>

      </div>

      <div className="mt-3">

        {children}

      </div>

    </div>

  );

}

/*

 * ============================================================

 * CAMERA ERROR MESSAGE

 * ============================================================

 */

function getCameraErrorMessage(

  error: unknown

) {

  if (

    error instanceof Error

  ) {

    const message =

      error.message.toLowerCase();

    if (

      message.includes(

        "permission"

      ) ||

      message.includes(

        "notallowed"

      )

    ) {

      return "Camera permission was denied. Please allow camera access and try again.";

    }

    if (

      message.includes(

        "notfound"

      ) ||

      message.includes(

        "no camera"

      )

    ) {

      return "No usable camera was found on this device.";

    }

    if (

      message.includes(

        "in use"

      ) ||

      message.includes(

        "already"

      )

    ) {

      return "The camera is already being used by another application.";

    }

    return error.message;

  }

  return "Unable to start the camera scanner.";

}
