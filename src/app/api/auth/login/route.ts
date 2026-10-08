import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    if (!email || !password) {
      return NextResponse.json(
        {
          error:
            "Email and password are required.",
        },
        { status: 400 }
      );
    }

    const admin =
      await prisma.adminUser.findUnique({
        where: { email },
      });

    if (!admin) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    const validPassword =
      await bcrypt.compare(
        password,
        admin.passwordHash
      );

    if (!validPassword) {
      return NextResponse.json(
        {
          error:
            "Invalid email or password.",
        },
        { status: 401 }
      );
    }

    await createSession(admin.id);

    const redirectTo =
      admin.role === "SCANNER"
        ? "/gate"
        : "/dashboard";

    return NextResponse.json({
      success: true,

      redirectTo,

      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong.",
      },
      { status: 500 }
    );
  }
}