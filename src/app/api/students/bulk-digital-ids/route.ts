import { NextResponse } from "next/server";
import crypto from "crypto";
import QRCode from "qrcode";
import {
  PDFDocument,
  rgb,
  StandardFonts,
} from "pdf-lib";

import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PdfMode =
  | "ALL"
  | "YEAR"
  | "BRANCH"
  | "YEAR_BRANCH"
  | "SELECTED";

function generateQrCredential() {
  return crypto.randomBytes(32).toString("hex");
}

function hashQrCredential(token: string) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    // --------------------------------------------------
    // AUTH
    // --------------------------------------------------

    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        {
          error:
            "Only administrators can generate Digital IDs.",
        },
        { status: 403 }
      );
    }

    // --------------------------------------------------
    // REQUEST
    // --------------------------------------------------

    const body = await request.json();

    const mode: PdfMode =
      body.mode || "SELECTED";

    const year =
      typeof body.year === "number"
        ? body.year
        : undefined;

    const branch =
      typeof body.branch === "string" &&
      body.branch.trim().length > 0
        ? body.branch.trim()
        : undefined;

    const studentIds = Array.isArray(
      body.studentIds
    )
      ? body.studentIds.filter(
          (id: unknown): id is string =>
            typeof id === "string" &&
            id.trim().length > 0
        )
      : [];

    // --------------------------------------------------
    // VALIDATE MODE
    // --------------------------------------------------

    const validModes: PdfMode[] = [
      "ALL",
      "YEAR",
      "BRANCH",
      "YEAR_BRANCH",
      "SELECTED",
    ];

    if (!validModes.includes(mode)) {
      return NextResponse.json(
        {
          error: "Invalid PDF generation mode.",
        },
        { status: 400 }
      );
    }

    if (
      (mode === "YEAR" ||
        mode === "YEAR_BRANCH") &&
      year !== 1 &&
      year !== 2
    ) {
      return NextResponse.json(
        {
          error:
            "A valid year (1 or 2) is required.",
        },
        { status: 400 }
      );
    }

    if (
      (mode === "BRANCH" ||
        mode === "YEAR_BRANCH") &&
      !branch
    ) {
      return NextResponse.json(
        {
          error:
            "A branch is required for this PDF scope.",
        },
        { status: 400 }
      );
    }

    if (
      mode === "SELECTED" &&
      studentIds.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "No students were selected.",
        },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // BUILD STUDENT FILTER
    // --------------------------------------------------

    let where: any = {
      status: "ACTIVE",
    };

    switch (mode) {
      case "ALL":
        break;

      case "YEAR":
        where.year = year;
        break;

      case "BRANCH":
        where.branch = branch;
        break;

      case "YEAR_BRANCH":
        where.year = year;
        where.branch = branch;
        break;

      case "SELECTED":
        where.id = {
          in: studentIds,
        };
        break;
    }

    // --------------------------------------------------
    // LOAD STUDENTS
    // --------------------------------------------------

    const students =
      await prisma.student.findMany({
        where,
        select: {
          id: true,
          rollNo: true,
          studentName: true,
          program: true,
          branch: true,
          year: true,
        },
        orderBy: {
          rollNo: "asc",
        },
      });

    if (students.length === 0) {
      return NextResponse.json(
        {
          error:
            "No eligible active students found for this scope.",
        },
        { status: 404 }
      );
    }

    if (students.length > 2500) {
      return NextResponse.json(
        {
          error:
            "Maximum 2500 students can be generated in one PDF.",
        },
        { status: 400 }
      );
    }

    console.log(
      `Generating ${students.length} Digital IDs using mode ${mode}`
    );

    // --------------------------------------------------
    // GENERATE CREDENTIALS
    // --------------------------------------------------

    const generated = students.map(
      (student) => {
        const credential =
          generateQrCredential();

        return {
          student,
          credential,
          qrTokenHash:
            hashQrCredential(
              credential
            ),
        };
      }
    );

    // --------------------------------------------------
    // UPDATE DATABASE
    //
    // IMPORTANT:
    // Do NOT use prisma.$transaction([...updates])
    // for thousands of students.
    //
    // We use a single SQL UPDATE with CASE.
    // --------------------------------------------------

    const ids = generated.map(
      (item) => item.student.id
    );

    const cases = generated.map(
      (item) =>
        `WHEN '${item.student.id.replace(
          /'/g,
          "''"
        )}' THEN '${item.qrTokenHash}'`
    );

    const idList = ids
      .map(
        (id) =>
          `'${id.replace(/'/g, "''")}'`
      )
      .join(",");

    const updateQuery = `
      UPDATE "Student"
      SET
        "qrTokenHash" =
          CASE "id"
            ${cases.join("\n")}
          END,
        "updatedAt" = NOW()
      WHERE "id" IN (${idList})
    `;

    await prisma.$executeRawUnsafe(
      updateQuery
    );

    console.log(
      `Updated ${generated.length} QR credentials in database`
    );

    // --------------------------------------------------
    // CREATE PDF
    // --------------------------------------------------

    const pdf = await PDFDocument.create();

    const regularFont =
      await pdf.embedFont(
        StandardFonts.Helvetica
      );

    const boldFont =
      await pdf.embedFont(
        StandardFonts.HelveticaBold
      );

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // --------------------------------------------------
    // ONE STUDENT = ONE PAGE
    // --------------------------------------------------

    for (const item of generated) {
      const {
        student,
        credential,
      } = item;

      const page = pdf.addPage([
        595.28,
        841.89,
      ]);

      const pageWidth =
        page.getWidth();

      const pageHeight =
        page.getHeight();

      const cardWidth = 430;
      const cardHeight = 600;

      const cardX =
        (pageWidth - cardWidth) / 2;

      const cardY =
        (pageHeight - cardHeight) / 2;

      // ------------------------------------------------
      // CARD
      // ------------------------------------------------

      page.drawRectangle({
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        color: rgb(
          0.015,
          0.023,
          0.055
        ),
        borderColor: rgb(
          0.08,
          0.75,
          0.9
        ),
        borderWidth: 2,
      });

      // ------------------------------------------------
      // COLLEGE
      // ------------------------------------------------

      page.drawText(
        "NARSIMHA REDDY",
        {
          x: cardX + 32,
          y:
            cardY +
            cardHeight -
            48,
          size: 18,
          font: boldFont,
          color: rgb(
            0.95,
            0.98,
            1
          ),
        }
      );

      page.drawText(
        "ENGINEERING COLLEGE",
        {
          x: cardX + 32,
          y:
            cardY +
            cardHeight -
            70,
          size: 10,
          font: regularFont,
          color: rgb(
            0.55,
            0.65,
            0.75
          ),
        }
      );

      // ------------------------------------------------
      // EVENT
      // ------------------------------------------------

      page.drawText(
        "FRESHERS 2K26",
        {
          x: cardX + 32,
          y:
            cardY +
            cardHeight -
            102,
          size: 16,
          font: boldFont,
          color: rgb(
            0.1,
            0.85,
            0.95
          ),
        }
      );

      // ------------------------------------------------
      // PHOTO PLACEHOLDER
      // ------------------------------------------------

      const photoX =
        cardX + 32;

      const photoY =
        cardY +
        cardHeight -
        260;

      page.drawRectangle({
        x: photoX,
        y: photoY,
        width: 110,
        height: 135,
        color: rgb(
          0.05,
          0.07,
          0.12
        ),
        borderColor: rgb(
          0.2,
          0.25,
          0.32
        ),
        borderWidth: 1,
      });

      page.drawText("PHOTO", {
        x: photoX + 34,
        y: photoY + 62,
        size: 12,
        font: boldFont,
        color: rgb(
          0.35,
          0.4,
          0.48
        ),
      });

      // ------------------------------------------------
      // STUDENT DETAILS
      // ------------------------------------------------

      const detailsX =
        cardX + 165;

      page.drawText(
        student.studentName,
        {
          x: detailsX,
          y:
            cardY +
            cardHeight -
            150,
          size: 15,
          font: boldFont,
          color: rgb(
            0.95,
            0.98,
            1
          ),
          maxWidth: 225,
        }
      );

      page.drawText(
        `Roll No: ${student.rollNo}`,
        {
          x: detailsX,
          y:
            cardY +
            cardHeight -
            180,
          size: 10,
          font: regularFont,
          color: rgb(
            0.65,
            0.72,
            0.8
          ),
        }
      );

      page.drawText(
        `Branch: ${student.branch}`,
        {
          x: detailsX,
          y:
            cardY +
            cardHeight -
            202,
          size: 10,
          font: regularFont,
          color: rgb(
            0.65,
            0.72,
            0.8
          ),
        }
      );

      page.drawText(
        `Program: ${student.program}`,
        {
          x: detailsX,
          y:
            cardY +
            cardHeight -
            224,
          size: 10,
          font: regularFont,
          color: rgb(
            0.65,
            0.72,
            0.8
          ),
        }
      );

      page.drawText(
        `Year: ${
          student.year === 1
            ? "1st"
            : "2nd"
        } Year`,
        {
          x: detailsX,
          y:
            cardY +
            cardHeight -
            246,
          size: 10,
          font: regularFont,
          color: rgb(
            0.65,
            0.72,
            0.8
          ),
        }
      );

      // ------------------------------------------------
      // QR
      // ------------------------------------------------

      const verificationUrl =
        `${baseUrl}/v/${encodeURIComponent(
          credential
        )}`;

      const qrDataUrl =
        await QRCode.toDataURL(
          verificationUrl,
          {
            width: 260,
            margin: 1,
            errorCorrectionLevel: "H",
          }
        );

      const qrBase64 =
        qrDataUrl.split(",")[1];

      const qrBytes =
        Buffer.from(
          qrBase64,
          "base64"
        );

      const qrImage =
        await pdf.embedPng(
          qrBytes
        );

      const qrSize = 175;

      page.drawRectangle({
        x:
          cardX +
          (cardWidth -
            qrSize -
            30) /
            2,
        y: cardY + 115,
        width: qrSize + 30,
        height: qrSize + 30,
        color: rgb(
          1,
          1,
          1
        ),
      });

      page.drawImage(
        qrImage,
        {
          x:
            cardX +
            (cardWidth -
              qrSize) /
              2,
          y: cardY + 130,
          width: qrSize,
          height: qrSize,
        }
      );

      page.drawText(
        "SCAN FOR ENTRY VERIFICATION",
        {
          x: cardX + 113,
          y: cardY + 95,
          size: 9,
          font: boldFont,
          color: rgb(
            0.1,
            0.85,
            0.95
          ),
        }
      );

      // ------------------------------------------------
      // ACTIVE BADGE
      // ------------------------------------------------

      page.drawRectangle({
        x: cardX + 32,
        y: cardY + 42,
        width: 75,
        height: 25,
        color: rgb(
          0.04,
          0.2,
          0.13
        ),
      });

      page.drawText(
        "ACTIVE",
        {
          x: cardX + 48,
          y: cardY + 51,
          size: 9,
          font: boldFont,
          color: rgb(
            0.25,
            0.95,
            0.55
          ),
        }
      );

      page.drawText(
        "STUDENT ENTRY PASS",
        {
          x: cardX + 270,
          y: cardY + 51,
          size: 9,
          font: boldFont,
          color: rgb(
            0.45,
            0.52,
            0.62
          ),
        }
      );
    }

    // --------------------------------------------------
    // SAVE PDF
    // --------------------------------------------------

    const pdfBytes =
      await pdf.save();

    // --------------------------------------------------
    // FILENAME
    // --------------------------------------------------

    let filename =
      "freshers-digital-ids.pdf";

    switch (mode) {
      case "ALL":
        filename =
          "freshers-all-digital-ids.pdf";
        break;

      case "YEAR":
        filename =
          `freshers-${year === 1 ? "1st" : "2nd"}-year-digital-ids.pdf`;
        break;

      case "BRANCH":
        filename =
          `freshers-${branch}-digital-ids.pdf`;
        break;

      case "YEAR_BRANCH":
        filename =
          `freshers-${year === 1 ? "1st" : "2nd"}-year-${branch}-digital-ids.pdf`;
        break;

      case "SELECTED":
        filename =
          "freshers-selected-digital-ids.pdf";
        break;
    }

    // --------------------------------------------------
    // RESPONSE
    // --------------------------------------------------

    return new NextResponse(
      Buffer.from(pdfBytes),
      {
        status: 200,
        headers: {
          "Content-Type":
            "application/pdf",

          "Content-Disposition":
            `attachment; filename="${filename}"`,

          "Cache-Control":
            "no-store",

          "X-Generated-Students":
            String(generated.length),
        },
      }
    );
  } catch (error) {
    console.error(
      "Bulk digital ID generation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate Digital ID PDF.",
      },
      {
        status: 500,
      }
    );
  }
}