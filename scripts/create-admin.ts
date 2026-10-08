import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const name = "Freshers Gate Admin";
  const email = "admin@freshersgate.local";
  const password = "1234567890";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.adminUser.upsert({
    where: {
      email,
    },
    update: {
      name,
      passwordHash,
      role: "ADMIN",
    },
    create: {
      name,
      email,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Admin created successfully:");
  console.log({
    id: admin.id,
    name: admin.name,
    email: admin.email,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });