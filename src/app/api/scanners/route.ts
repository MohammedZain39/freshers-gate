import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentAdmin } from "@/lib/auth";

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 403 }
      );
    }

    const scanners = await prisma.adminUser.findMany({
      where: {
        role: "SCANNER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      scanners,
    });
  } catch (error) {
    console.error("Get scanners error:", error);

    return NextResponse.json(
      { error: "Failed to load scanner accounts." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin || admin.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const name =
      typeof body.name === "string" ? body.name.trim() : "";

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!name || !email || !password) {
      return NextResponse.json(
        {
          error: "Name, email and password are required.",
        },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        {
          error: "Password must be at least 8 characters.",
        },
        { status: 400 }
      );
    }

    const existing = await prisma.adminUser.findUnique({
      where: {
        email,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const scanner = await prisma.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: "SCANNER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        scanner,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create scanner error:", error);

    return NextResponse.json(
      { error: "Failed to create scanner account." },
      { status: 500 }
    );
  }
}