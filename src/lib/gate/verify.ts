import {
  getStudentByQrHash,
  markStudentEntered,
} from "@/lib/offline/students";

import {
  queueOfflineScan,
} from "@/lib/offline/queue";

import {
  hashQrToken,
} from "./hash";

export type GateVerificationResult = {
  success: boolean;
  source: "ONLINE" | "OFFLINE";

  status:
    | "ALLOWED"
    | "ALREADY_SCANNED"
    | "INVALID_QR"
    | "NOT_AUTHORIZED"
    | "NOT_ELIGIBLE"
    | "ENTRY_CLOSED"
    | "SERVER_ERROR";

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

// =============================================
// EXTRACT TOKEN FROM QR
// =============================================

function extractToken(
  scannedValue: string
) {
  const value =
    scannedValue.trim();

  // Full URL:
  // https://domain.com/v/<token>
  try {
    const url =
      new URL(value);

    const parts =
      url.pathname
        .split("/")
        .filter(Boolean);

    const vIndex =
      parts.findIndex(
        (part) =>
          part === "v"
      );

    if (
      vIndex !== -1 &&
      parts[vIndex + 1]
    ) {
      return parts[
        vIndex + 1
      ];
    }
  } catch {
    // Not a URL.
  }

  // Raw token
  if (
    /^[a-fA-F0-9]{64}$/.test(
      value
    )
  ) {
    return value;
  }

  return null;
}

// =============================================
// LOCAL DATE FORMAT
// =============================================

function formatIST(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Kolkata",
    }
  ).format(date);
}

// =============================================
// OFFLINE VERIFICATION
// =============================================

async function verifyOffline(
  token: string
): Promise<GateVerificationResult> {
  const qrTokenHash =
    await hashQrToken(token);

  const student =
    await getStudentByQrHash(
      qrTokenHash
    );

  // -----------------------------------------
  // INVALID QR
  // -----------------------------------------

  if (!student) {
    return {
      success: false,
      source: "OFFLINE",
      status: "INVALID_QR",
      title: "INVALID QR",
      subtitle:
        "QR NOT RECOGNIZED",
      message:
        "This QR code is not recognized by the offline gate database.",
    };
  }

  // -----------------------------------------
  // INACTIVE
  // -----------------------------------------

  if (
    student.status !==
    "ACTIVE"
  ) {
    return {
      success: false,
      source: "OFFLINE",
      status: "NOT_AUTHORIZED",
      title: "NOT AUTHORIZED",
      subtitle:
        "ENTRY DENIED",
      message:
        "This student is currently not authorized to enter.",
      student: {
        name:
          student.studentName,
        rollNo:
          student.rollNo,
        program:
          student.program,
        branch:
          student.branch,
        year:
          student.year,
      },
    };
  }

  // -----------------------------------------
  // YEAR CHECK
  // -----------------------------------------

  if (
    student.year !== 1 &&
    student.year !== 2
  ) {
    return {
      success: false,
      source: "OFFLINE",
      status: "NOT_ELIGIBLE",
      title: "NOT ELIGIBLE",
      subtitle:
        "ENTRY DENIED",
      message:
        "Only 1st and 2nd year students are eligible.",
      student: {
        name:
          student.studentName,
        rollNo:
          student.rollNo,
        program:
          student.program,
        branch:
          student.branch,
        year:
          student.year,
      },
    };
  }

  // -----------------------------------------
  // ALREADY ENTERED
  // -----------------------------------------

  if (
    student.enteredAt
  ) {
    return {
      success: true,
      source: "OFFLINE",
      status:
        "ALREADY_SCANNED",
      title:
        "ALREADY SCANNED",
      subtitle:
        "ENTRY ALREADY RECORDED",
      message:
        "This student has already entered the event.",
      student: {
        name:
          student.studentName,
        rollNo:
          student.rollNo,
        program:
          student.program,
        branch:
          student.branch,
        year:
          student.year,
      },
      enteredAtIST:
        formatIST(
          new Date(
            student.enteredAt
          )
        ),
    };
  }

  // -----------------------------------------
  // LOCAL ATOMIC CLAIM
  // -----------------------------------------

  const now =
    new Date();

  const claimed =
    await markStudentEntered(
      student.id,
      now.toISOString()
    );

  // -----------------------------------------
  // LOCAL DUPLICATE
  // -----------------------------------------

  if (!claimed) {
    const latest =
      await getStudentByQrHash(
        qrTokenHash
      );

    if (
      latest?.enteredAt
    ) {
      return {
        success: true,
        source: "OFFLINE",
        status:
          "ALREADY_SCANNED",
        title:
          "ALREADY SCANNED",
        subtitle:
          "ENTRY ALREADY RECORDED",
        message:
          "This student has already entered the event.",
        student: {
          name:
            latest.studentName,
          rollNo:
            latest.rollNo,
          program:
            latest.program,
          branch:
            latest.branch,
          year:
            latest.year,
        },
        enteredAtIST:
          formatIST(
            new Date(
              latest.enteredAt
            )
          ),
      };
    }

    return {
      success: false,
      source: "OFFLINE",
      status:
        "SERVER_ERROR",
      title:
        "VERIFICATION FAILED",
      subtitle:
        "PLEASE TRY AGAIN",
      message:
        "Unable to verify this QR locally.",
    };
  }

  // -----------------------------------------
  // ADD OFFLINE SCAN TO QUEUE
  // -----------------------------------------

  await queueOfflineScan(
    student.id,
    qrTokenHash,
    now.toISOString()
  );

  // -----------------------------------------
  // OFFLINE SUCCESS
  // -----------------------------------------

  return {
    success: true,
    source: "OFFLINE",
    status: "ALLOWED",
    title: "ENTRY ALLOWED",
    subtitle: "AUTHORIZED",
    message:
      "Entry recorded locally. It will sync automatically when internet returns.",
    student: {
      name:
        student.studentName,
      rollNo:
        student.rollNo,
      program:
        student.program,
      branch:
        student.branch,
      year:
        student.year,
    },
    enteredAtIST:
      formatIST(now),
  };
}

// =============================================
// ONLINE VERIFICATION
// =============================================

async function verifyOnline(
  token: string
): Promise<GateVerificationResult> {
  const controller =
    new AbortController();

  /*
   * Five seconds maximum.
   *
   * If the server takes longer than this,
   * immediately switch to local verification.
   */
  const timeout =
    window.setTimeout(
      () => {
        controller.abort();
      },
      5000
    );

  try {
    const response =
      await fetch(
        `/api/verify/${encodeURIComponent(
          token
        )}`,
        {
          method: "GET",

          cache: "no-store",

          headers: {
            Accept:
              "application/json",
          },

          signal:
            controller.signal,
        }
      );

    /*
     * IMPORTANT:
     *
     * A valid HTTP response means the server
     * successfully handled the request.
     *
     * Therefore:
     *
     * 200 + ALLOWED
     * 200 + ALREADY_SCANNED
     * 200 + ENTRY_CLOSED
     * 200 + NOT_AUTHORIZED
     * 404 + INVALID_QR
     *
     * are all server decisions.
     *
     * We trust those decisions.
     */

    if (
      response.ok ||
      response.status === 404
    ) {
      const data =
        await response.json();

      return {
        ...data,
        source: "ONLINE",
      };
    }

    /*
     * 500 / 502 / 503 / 504 etc.
     *
     * The server itself is unavailable.
     *
     * Throw so the caller uses the local DB.
     */

    throw new Error(
      `Verification server returned ${response.status}`
    );
  } finally {
    window.clearTimeout(
      timeout
    );
  }
}

// =============================================
// MAIN VERIFICATION ENGINE
// =============================================

export async function verifyGateQr(
  scannedValue: string
): Promise<GateVerificationResult> {
  // -----------------------------------------
  // EXTRACT TOKEN
  // -----------------------------------------

  const token =
    extractToken(
      scannedValue
    );

  // -----------------------------------------
  // INVALID FORMAT
  // -----------------------------------------

  if (
    !token ||
    token.length !== 64 ||
    !/^[a-fA-F0-9]{64}$/.test(
      token
    )
  ) {
    return {
      success: false,
      source: navigator.onLine
        ? "ONLINE"
        : "OFFLINE",
      status:
        "INVALID_QR",
      title:
        "INVALID QR",
      subtitle:
        "QR NOT RECOGNIZED",
      message:
        "This QR code is invalid or not recognized.",
    };
  }

  // -----------------------------------------
  // ONLINE FIRST
  // -----------------------------------------

  if (
    navigator.onLine
  ) {
    try {
      return await verifyOnline(
        token
      );
    } catch (error) {
      /*
       * THIS IS THE IMPORTANT PART.
       *
       * Internet may technically be "online"
       * but:
       *
       * - Vercel could be unavailable
       * - API could crash
       * - Supabase could be unavailable
       * - connection could be extremely slow
       * - request could timeout
       *
       * In ALL those cases we fall back
       * to the local database.
       */

      console.warn(
        "Online verification unavailable. Falling back to offline database.",
        error
      );
    }
  }

  // -----------------------------------------
  // OFFLINE FALLBACK
  // -----------------------------------------

  try {
    return await verifyOffline(
      token
    );
  } catch (error) {
    console.error(
      "Offline verification failed:",
      error
    );

    return {
      success: false,
      source: "OFFLINE",
      status:
        "SERVER_ERROR",
      title:
        "VERIFICATION FAILED",
      subtitle:
        "PLEASE TRY AGAIN",
      message:
        "Unable to verify this QR using the local gate database.",
    };
  }
}