import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const notes = await prisma.deletedNote.findMany();
  console.log('Total deleted notes:', notes.length);
  if (notes.length > 0) {
    console.log(JSON.stringify(notes[0], null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
