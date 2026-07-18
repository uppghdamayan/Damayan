import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Request,
  NotFoundException,
  Query,
  Delete,
} from '@nestjs/common';
import { ProgressNotesService } from './progress-notes.service';
import { CreateProgressNoteDto } from './dto/create-progress-note.dto';
import { UpdateProgressNoteDto } from './dto/update-progress-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, NoteStatus } from '@prisma/client';
import { AuthorGuard } from '../auth/guards/author.guard';
import { NoteModel } from '../auth/decorators/note-model.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Progress Notes')
@Controller('patients/:patientId/progress-notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProgressNotesController {
  constructor(private readonly progressNotesService: ProgressNotesService) {}

  @Get()
  async findAll(
    @Param('patientId') patientId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Request() req,
  ) {
    const result = await this.progressNotesService.findAllByPatient(
      patientId,
      +page,
      +limit,
    );

    // Filter out drafts that the user shouldn't see
    const filteredData = result.data.filter((note) => {
      if (note.status === NoteStatus.PUBLISHED) return true;
      if (req.user.role === Role.ADMIN) return true;
      if (req.user.role === Role.DOCTOR && req.user.id === note.authorId)
        return true;
      return false; // Nurses shouldn't see drafts, or other doctors
    });

    return {
      ...result,
      data: filteredData,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    const note = await this.progressNotesService.findOne(id);

    if (note.status === NoteStatus.DRAFT) {
      if (
        req.user.role === Role.DOCTOR &&
        req.user.id !== note.authorId &&
        req.user.role !== Role.ADMIN
      ) {
        throw new NotFoundException('Progress Note not found');
      }
    }

    return note;
  }

  @Post()
  @Roles(Role.DOCTOR, Role.ADMIN)
  create(
    @Param('patientId') patientId: string,
    @Body() createProgressNoteDto: CreateProgressNoteDto,
    @Request() req,
  ) {
    return this.progressNotesService.create(
      patientId,
      createProgressNoteDto,
      req.user.id,
    );
  }

  @Post('create-and-publish')
  @Roles(Role.DOCTOR, Role.ADMIN)
  createAndPublish(
    @Param('patientId') patientId: string,
    @Body() createProgressNoteDto: CreateProgressNoteDto,
    @Request() req,
  ) {
    return this.progressNotesService.createAndPublish(
      patientId,
      createProgressNoteDto,
      req.user.id,
    );
  }

  @Patch(':id')
  @UseGuards(AuthorGuard)
  @NoteModel('progressNote')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProgressNoteDto,
    @Request() req,
  ) {
    return this.progressNotesService.update(id, dto, req.user.id);
  }

  @Post(':id/publish')
  @UseGuards(AuthorGuard)
  @NoteModel('progressNote')
  publish(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.progressNotesService.publish(patientId, id, req.user.id);
  }

  @Delete('drafts')
  @Roles(Role.DOCTOR, Role.ADMIN)
  removeAllDrafts(@Param('patientId') patientId: string, @Request() req) {
    return this.progressNotesService.deleteAllDrafts(patientId, req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthorGuard)
  @NoteModel('progressNote')
  remove(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.progressNotesService.deleteDraft(patientId, id, req.user.id);
  }
}
