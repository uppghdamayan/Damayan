const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const meds = await prisma.medication.findMany();
  console.log('Meds after:', meds.map(m => m.dose));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
