import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DeletedNotesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByPatient(patientId: string) {
    return this.prisma.deletedNote.findMany({
      where: { patientId },
      orderBy: { deletedAt: 'desc' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, role: true } },
        deletedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
        visit: true,
      },
    });
  }
}
