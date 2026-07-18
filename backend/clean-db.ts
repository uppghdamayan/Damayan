import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.document.deleteMany({
    where: { documentType: 'CHARGE_SLIP' as any },
  });
  console.log('Deleted charge slips');
}

main().finally(() => prisma.$disconnect());
