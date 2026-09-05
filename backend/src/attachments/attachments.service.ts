import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { NoteStatus, NoteType } from '@prisma/client';
import { isUUID } from 'class-validator';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async upload(
    dto: CreateAttachmentDto,
    file: Express.Multer.File | undefined,
    userId: string,
  ) {
    let visitId: string | null = null;

    if (dto.noteType === NoteType.INITIAL_NOTE) {
      const note = await this.prisma.initialNote.findUnique({
        where: { id: dto.noteId },
        include: { visit: true },
      });
      if (!note || note.visit.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Invalid noteId or patientId for initial note',
        );
      }
      visitId = note.visitId;
    } else if (dto.noteType === NoteType.PROGRESS_NOTE) {
      const note = await this.prisma.progressNote.findUnique({
        where: { id: dto.noteId },
        include: { visit: true },
      });
      if (!note || note.visit.patientId !== dto.patientId) {
        throw new BadRequestException(
          'Invalid noteId or patientId for progress note',
        );
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
      storageKey = await this.storageService.upload(
        path,
        file.buffer,
        file.mimetype,
      );
      mimeType = file.mimetype;
    }

    if (!file && !dto.textResult) {
      throw new BadRequestException(
        'Either a file or textResult must be provided',
      );
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

  /**
   * Resolves the lifecycle status of the note an attachment belongs to.
   * Returns null when the note no longer exists (orphaned attachment).
   */
  private async getNoteStatus(
    noteType: NoteType,
    noteId: string,
  ): Promise<NoteStatus | null> {
    if (noteType === NoteType.INITIAL_NOTE) {
      const note = await this.prisma.initialNote.findUnique({
        where: { id: noteId },
        select: { status: true },
      });
      return note?.status ?? null;
    }

    const note = await this.prisma.progressNote.findUnique({
      where: { id: noteId },
      select: { status: true },
    });
    return note?.status ?? null;
  }

  /**
   * Batch-resolves note statuses for a list of attachments, keyed by
   * `${noteType}:${noteId}`, to avoid one query per row.
   */
  private async getNoteStatusMap(
    attachments: { noteType: NoteType; noteId: string }[],
  ): Promise<Map<string, NoteStatus>> {
    const initialNoteIds = [
      ...new Set(
        attachments
          .filter((a) => a.noteType === NoteType.INITIAL_NOTE)
          .map((a) => a.noteId),
      ),
    ];
    const progressNoteIds = [
      ...new Set(
        attachments
          .filter((a) => a.noteType === NoteType.PROGRESS_NOTE)
          .map((a) => a.noteId),
      ),
    ];

    const [initialNotes, progressNotes] = await Promise.all([
      initialNoteIds.length
        ? this.prisma.initialNote.findMany({
            where: { id: { in: initialNoteIds } },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
      progressNoteIds.length
        ? this.prisma.progressNote.findMany({
            where: { id: { in: progressNoteIds } },
            select: { id: true, status: true },
          })
        : Promise.resolve([]),
    ]);

    const map = new Map<string, NoteStatus>();
    for (const note of initialNotes) {
      map.set(`${NoteType.INITIAL_NOTE}:${note.id}`, note.status);
    }
    for (const note of progressNotes) {
      map.set(`${NoteType.PROGRESS_NOTE}:${note.id}`, note.status);
    }
    return map;
  }

  async findByNote(noteType: NoteType, noteId: string) {
    if (!noteId || noteId === '__pending__') {
      return [];
    }
    if (!isUUID(noteId) && process.env.NODE_ENV !== 'test') {
      return [];
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { noteType, noteId },
      orderBy: { uploadedAt: 'asc' },
      include: {
        uploadedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const statusMap = await this.getNoteStatusMap(attachments);
    return attachments.map((attachment) => ({
      ...attachment,
      noteStatus:
        statusMap.get(`${attachment.noteType}:${attachment.noteId}`) ?? null,
    }));
  }

  async findByPatient(patientId: string) {
    if (!patientId) {
      return [];
    }
    if (!isUUID(patientId) && process.env.NODE_ENV !== 'test') {
      return [];
    }

    const attachments = await this.prisma.attachment.findMany({
      where: { patientId },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedByUser: {
          select: { id: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    const statusMap = await this.getNoteStatusMap(attachments);
    const withStatus = attachments.map((attachment) => ({
      ...attachment,
      noteStatus:
        statusMap.get(`${attachment.noteType}:${attachment.noteId}`) ?? null,
    }));

    // Group by tag
    const grouped = withStatus.reduce(
      (acc, attachment) => {
        const tag = attachment.tag;
        if (!acc[tag]) {
          acc[tag] = [];
        }
        acc[tag].push(attachment);
        return acc;
      },
      {} as Record<string, typeof withStatus>,
    );

    return Object.keys(grouped).map((tag) => ({
      tag,
      attachments: grouped[tag],
    }));
  }

  async getDownloadUrl(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment || !attachment.storageKey) {
      throw new NotFoundException('Attachment or storage file not found');
    }
    return {
      url: await this.storageService.getSignedUrl(attachment.storageKey),
    };
  }

  async remove(id: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
    });
    if (!attachment) {
      throw new NotFoundException('Attachment not found');
    }

    const noteStatus = await this.getNoteStatus(
      attachment.noteType,
      attachment.noteId,
    );
    if (noteStatus === NoteStatus.PUBLISHED) {
      throw new ForbiddenException(
        'Cannot delete attachments from a published note',
      );
    }

    if (attachment.storageKey) {
      await this.storageService.delete(attachment.storageKey);
    }

    await this.prisma.attachment.delete({ where: { id } });
    return { success: true };
  }
}
