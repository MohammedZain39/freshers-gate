import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentAdmin } from "@/lib/auth";

type ParsedStudent = {
  rollNo: string;
  studentName: string;
  program: string;
  branch: string;
  year: number;
};

const REQUIRED_COLUMNS = [
  "S.No.",
  "RollNo",
  "StudentName",
  "Program",
  "Branch",
  "Year",
];

export async function POST(request: Request) {
  try {
    // Authentication
    const admin = await getCurrentAdmin();

    if (!admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Read uploaded file
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No Excel file uploaded." },
        { status: 400 }
      );
    }

    // Validate extension
    const fileName = file.name.toLowerCase();

    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Only .xlsx or .xls files are supported." },
        { status: 400 }
      );
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = XLSX.read(buffer, {
      type: "buffer",
    });

    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: "The Excel file contains no sheets." },
        { status: 400 }
      );
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      worksheet,
      {
        defval: "",
      }
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The selected sheet contains no student records." },
        { status: 400 }
      );
    }

    // Validate columns
    const actualColumns = Object.keys(rows[0]);

    const missingColumns = REQUIRED_COLUMNS.filter(
      (column) => !actualColumns.includes(column)
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid Excel format.",
          missingColumns,
          expectedColumns: REQUIRED_COLUMNS,
          actualColumns,
        },
        { status: 400 }
      );
    }

    const students: ParsedStudent[] = [];
    const errors: {
      row: number;
      error: string;
    }[] = [];

    const rollNumbers = new Set<string>();

    rows.forEach((row, index) => {
      const excelRow = index + 2;

      const rollNo = String(row.RollNo ?? "").trim();
      const studentName = String(row.StudentName ?? "").trim();
      const program = String(row.Program ?? "").trim();
      const branch = String(row.Branch ?? "").trim();
      const yearValue = String(row.Year ?? "").trim();

      if (!rollNo) {
        errors.push({
          row: excelRow,
          error: "RollNo is missing.",
        });
        return;
      }

      if (!studentName) {
        errors.push({
          row: excelRow,
          error: "StudentName is missing.",
        });
        return;
      }

      if (!program) {
        errors.push({
          row: excelRow,
          error: "Program is missing.",
        });
        return;
      }

      if (!branch) {
        errors.push({
          row: excelRow,
          error: "Branch is missing.",
        });
        return;
      }

      if (!yearValue) {
        errors.push({
          row: excelRow,
          error: "Year is missing.",
        });
        return;
      }

      const year = Number(yearValue);

      if (![1, 2].includes(year)) {
        errors.push({
          row: excelRow,
          error: `Invalid Year "${yearValue}". Only 1 or 2 is allowed.`,
        });
        return;
      }

      if (program.toUpperCase() !== "B.TECH") {
        errors.push({
          row: excelRow,
          error: `Invalid Program "${program}". Only B.TECH is allowed.`,
        });
        return;
      }

      const normalizedRollNo = rollNo.toUpperCase();

      if (rollNumbers.has(normalizedRollNo)) {
        errors.push({
          row: excelRow,
          error: `Duplicate RollNo "${rollNo}" found in this file.`,
        });
        return;
      }

      rollNumbers.add(normalizedRollNo);

      students.push({
        rollNo,
        studentName,
        program,
        branch,
        year,
      });
    });

    return NextResponse.json({
      success: true,
      fileName: file.name,
      sheetName,
      totalRows: rows.length,
      validRows: students.length,
      invalidRows: errors.length,
      students,
      errors,
      previewLimited: false,
    });
  } catch (error) {
    console.error("Student import validation error:", error);

    return NextResponse.json(
      {
        error: "Failed to process the Excel file.",
      },
      { status: 500 }
    );
  }
}