import { Body, Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, NoteType } from '@prisma/client';

@Controller('attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('upload')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Body() createAttachmentDto: CreateAttachmentDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    return this.attachmentsService.upload(createAttachmentDto, file, req.user.id);
  }

  @Get()
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async findAll(
    @Query('noteType') noteType?: NoteType,
    @Query('noteId') noteId?: string,
    @Query('patientId') patientId?: string,
  ) {
    if (noteType && noteId) {
      return this.attachmentsService.findByNote(noteType, noteId);
    } else if (patientId) {
      return this.attachmentsService.findByPatient(patientId);
    }
    return [];
  }

  @Get(':id')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async findOne(@Param('id') id: string) {
    // Basic fetch if needed, frontend mostly relies on the grouped lists
    return { id };
  }

  @Get(':id/download')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async download(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR, Role.ADMIN)
  async remove(@Param('id') id: string) {
    return this.attachmentsService.remove(id);
  }
}
