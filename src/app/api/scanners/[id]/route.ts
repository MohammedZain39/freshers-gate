import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const scanner = await prisma.adminUser.findUnique({
      where: { id },
    });

    if (!scanner || scanner.role !== "SCANNER") {
      return NextResponse.json(
        { error: "Scanner account not found." },
        { status: 404 }
      );
    }

    // Reset password
    if (typeof body.password === "string") {
      if (body.password.length < 8) {
        return NextResponse.json(
          {
            error: "Password must be at least 8 characters.",
          },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(
        body.password,
        12
      );

      await prisma.adminUser.update({
        where: { id },
        data: { passwordHash },
      });

      return NextResponse.json({
        success: true,
        message: "Scanner password updated.",
      });
    }

    return NextResponse.json(
      {
        error: "No valid update was provided.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Update scanner error:", error);

    return NextResponse.json(
      { error: "Failed to update scanner account." },
      { status: 500 }
    );
  }
}