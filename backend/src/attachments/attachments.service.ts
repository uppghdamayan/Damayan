import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { NoteType } from '@prisma/client';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async upload(dto: CreateAttachmentDto, file: Express.Multer.File | undefined, userId: string) {
    let visitId: string | null = null;

    if (dto.noteType === NoteType.INITIAL_NOTE) {
      const note = await this.prisma.initialNote.findUnique({ where: { id: dto.noteId }, include: { visit: true } });
      if (!note || note.visit.patientId !== dto.patientId) {
        throw new BadRequestException('Invalid noteId or patientId for initial note');
      }
      visitId = note.visitId;
    } else if (dto.noteType === NoteType.PROGRESS_NOTE) {
      const note = await this.prisma.progressNote.findUnique({ where: { id: dto.noteId }, include: { visit: true } });
      if (!note || note.visit.patientId !== dto.patientId) {
        throw new BadRequestException('Invalid noteId or patientId for progress note');
      }
      visitId = note.visitId;
    } else {
      throw new BadRequestException('Invalid noteType');
    }

    let storageKey: string | null = null;
    let mimeType: string | null = null;

    if (file) {
      const timestamp = Date.now();
      const path = `patients/${dto.patientId}/documents/${timestamp}-${file.originalname}`;
      storageKey = await this.storageService.upload(path, file.buffer, file.mimetype);
      mimeType = file.mimetype;
    }

    if (!file && !dto.textResult) {
      throw new BadRequestException('Either a file or textResult must be provided');
    }

    return this.prisma.attachment.create({
      data: {
        patientId: dto.patientId,
        noteType: dto.noteType,
        noteId: dto.noteId,
        tag: dto.tag,
        textResult: dto.textResult,
        storageKey,
        mimeType,
        uploadedBy: userId,
      },
    });
  }

  async findByNote(noteType: NoteType, noteId: string) {
    return this.prisma.attachment.findMany({
      where: { noteType, noteId },
      orderBy: { uploadedAt: 'asc' },
      include: {
        uploadedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      }
    });
  }

  async findByPatient(patientId: string) {
    const attachments = await this.prisma.attachment.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedByUser: { select: { id: true, firstName: true, lastName: true, role: true } },
      }
    });

    // Group by tag
    const grouped = attachments.reduce((acc, attachment) => {
      const tag = attachment.tag;
      if (!acc[tag]) {
        acc[tag] = [];
      }
      acc[tag].push(attachment);
      return acc;
    }, {} as Record<string, typeof attachments>);

    return Object.keys(grouped).map(tag => ({
      tag,
      attachments: grouped[tag],
    }));
  }

  async getDownloadUrl(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment || !attachment.storageKey) {
      throw new NotFoundException('Attachment or storage file not found');
    }
    return { url: await this.storageService.getSignedUrl(attachment.storageKey) };
  }

  async remove(id: string) {
    const attachment = await this.prisma.attachment.findUnique({ where: { id } });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    if (attachment.storageKey) {
      await this.storageService.delete(attachment.storageKey);
    }

    await this.prisma.attachment.delete({ where: { id } });
    return { success: true };
  }
}
