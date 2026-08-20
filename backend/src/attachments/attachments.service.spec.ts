import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NoteStatus, NoteType } from '@prisma/client';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: {
    attachment: { findUnique: jest.Mock; delete: jest.Mock };
    initialNote: { findUnique: jest.Mock };
    progressNote: { findUnique: jest.Mock };
  };
  let storage: { delete: jest.Mock };

  beforeEach(() => {
    prisma = {
      attachment: { findUnique: jest.fn(), delete: jest.fn() },
      initialNote: { findUnique: jest.fn() },
      progressNote: { findUnique: jest.fn() },
    };
    storage = { delete: jest.fn() };

    service = new AttachmentsService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
  });

  describe('remove', () => {
    it('throws NotFoundException when attachment does not exist', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when the initial note is PUBLISHED', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-1',
        noteType: NoteType.INITIAL_NOTE,
        noteId: 'note-1',
        storageKey: 'key-1',
      });
      prisma.initialNote.findUnique.mockResolvedValue({
        status: NoteStatus.PUBLISHED,
      });

      await expect(service.remove('att-1')).rejects.toThrow(ForbiddenException);
      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.attachment.delete).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the progress note is PUBLISHED', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-2',
        noteType: NoteType.PROGRESS_NOTE,
        noteId: 'note-2',
        storageKey: 'key-2',
      });
      prisma.progressNote.findUnique.mockResolvedValue({
        status: NoteStatus.PUBLISHED,
      });

      await expect(service.remove('att-2')).rejects.toThrow(ForbiddenException);
      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.attachment.delete).not.toHaveBeenCalled();
    });

    it('deletes storage and row when the note is DRAFT', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-3',
        noteType: NoteType.PROGRESS_NOTE,
        noteId: 'note-3',
        storageKey: 'key-3',
      });
      prisma.progressNote.findUnique.mockResolvedValue({
        status: NoteStatus.DRAFT,
      });
      prisma.attachment.delete.mockResolvedValue({});

      const result = await service.remove('att-3');

      expect(storage.delete).toHaveBeenCalledWith('key-3');
      expect(prisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-3' },
      });
      expect(result).toEqual({ success: true });
    });

    it('deletes an orphaned attachment whose note no longer exists', async () => {
      prisma.attachment.findUnique.mockResolvedValue({
        id: 'att-4',
        noteType: NoteType.INITIAL_NOTE,
        noteId: 'gone',
        storageKey: null,
      });
      prisma.initialNote.findUnique.mockResolvedValue(null);
      prisma.attachment.delete.mockResolvedValue({});

      const result = await service.remove('att-4');

      expect(storage.delete).not.toHaveBeenCalled();
      expect(prisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'att-4' },
      });
      expect(result).toEqual({ success: true });
    });
  });
});
