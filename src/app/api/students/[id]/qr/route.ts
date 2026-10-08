import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateQrCredential,
  hashQrCredential,
} from "@/lib/qr";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can generate QR credentials." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const student = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        rollNo: true,
        studentName: true,
        program: true,
        branch: true,
        year: true,
        status: true,
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    if (student.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Cannot generate QR for an inactive student." },
        { status: 400 }
      );
    }

    const credential = generateQrCredential();
    const credentialHash = hashQrCredential(credential);

    await prisma.student.update({
      where: { id: student.id },
      data: {
        qrTokenHash: credentialHash,
      },
    });

    return NextResponse.json({
      success: true,
      student,
      qrCredential: credential,
    });
  } catch (error) {
    console.error("QR generation error:", error);

    return NextResponse.json(
      { error: "Failed to generate QR credential." },
      { status: 500 }
    );
  }
}