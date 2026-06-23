import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';
import { NOTE_MODEL_KEY } from '../decorators/note-model.decorator';

@Injectable()
export class AuthorGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const noteModel = this.reflector.getAllAndOverride<
      'initialNote' | 'progressNote'
    >(NOTE_MODEL_KEY, [context.getHandler(), context.getClass()]);

    if (!noteModel) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const noteId = request.params.id;

    if (!user || !user.role) {
      throw new ForbiddenException('User not found in request');
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    if (!noteId) {
      throw new ForbiddenException('Note ID not found in route parameters');
    }

    const note = await (this.prisma[noteModel] as any).findUnique({
      where: { id: noteId },
      select: { authorId: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.authorId !== user.id) {
      throw new ForbiddenException(
        'Only the author or an admin can modify this note',
      );
    }

    return true;
  }
}
