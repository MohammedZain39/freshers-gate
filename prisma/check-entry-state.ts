import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const totalStudents = await prisma.student.count({
    where: {
      year: {
        in: [1, 2],
      },
    },
  });

  const scannedStudents = await prisma.student.count({
    where: {
      year: {
        in: [1, 2],
      },
      enteredAt: {
        not: null,
      },
    },
  });

  const entryLogs = await prisma.entryLog.count();

  const scanners = await prisma.adminUser.count({
    where: {
      role: "SCANNER",
    },
  });

  console.log("");
  console.log("===== FRESHERS GATE CHECK =====");
  console.log(`Eligible students : ${totalStudents}`);
  console.log(`Already entered   : ${scannedStudents}`);
  console.log(`Entry logs        : ${entryLogs}`);
  console.log(`Scanner accounts  : ${scanners}`);
  console.log("===============================");
  console.log("");
}

main()
  .catch((error) => {
    console.error("Check failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });