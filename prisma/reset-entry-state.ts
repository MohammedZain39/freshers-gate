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
  console.log("Resetting Freshers Gate entry state...");

  const deletedLogs = await prisma.entryLog.deleteMany({});

  const resetStudents = await prisma.student.updateMany({
    data: {
      enteredAt: null,
    },
  });

  console.log(`Deleted entry logs: ${deletedLogs.count}`);
  console.log(`Reset students: ${resetStudents.count}`);

  console.log("Entry state reset successfully.");
}

main()
  .catch((error) => {
    console.error("Reset failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });