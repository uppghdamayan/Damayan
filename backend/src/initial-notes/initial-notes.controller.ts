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
  Delete,
} from '@nestjs/common';
import { InitialNotesService } from './initial-notes.service';
import { CreateInitialNoteDto } from './dto/create-initial-note.dto';
import { UpdateInitialNoteDto } from './dto/update-initial-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role, NoteStatus } from '@prisma/client';
import { AuthorGuard } from '../auth/guards/author.guard';
import { NoteModel } from '../auth/decorators/note-model.decorator';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';

@ApiTags('Initial Notes')
@Controller('patients/:patientId/initial-note')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InitialNotesController {
  constructor(private readonly initialNotesService: InitialNotesService) {}

  @Get()
  async findOne(@Param('patientId') patientId: string, @Request() req) {
    const note = await this.initialNotesService.findOne(patientId);

    // Draft visibility rule
    if (note.status === NoteStatus.DRAFT) {
      if (req.user.id !== note.authorId && req.user.role !== Role.ADMIN) {
        throw new NotFoundException('Initial note not found for this patient.');
      }
    }

    return note;
  }

  @Get('all')
  async findAll(@Param('patientId') patientId: string, @Request() req) {
    const notes = await this.initialNotesService.findAll(patientId);

    // Filter out drafts that the user shouldn't see
    return notes.filter((note) => {
      if (note.status === NoteStatus.PUBLISHED) return true;
      if (req.user.role === Role.ADMIN) return true;
      if (req.user.role === Role.DOCTOR && req.user.id === note.authorId)
        return true;
      return false;
    });
  }

  // NOTE: the literal-segment routes below must stay declared above the
  // ':id'-prefixed ones — Nest matches in declaration order.

  @Get('logs')
  @ApiOperation({
    summary: 'List Initial Note change logs for a patient — All roles',
  })
  @ApiOkResponse({ description: 'List of initial note logs.' })
  async getLogs(@Param('patientId') patientId: string) {
    const data = await this.initialNotesService.getLogs(patientId);
    return { data };
  }

  @Get(':id/versions')
  @ApiOperation({
    summary: 'List version history for an Initial Note — All roles',
  })
  @ApiOkResponse({ description: 'Version metadata, newest first.' })
  async getVersions(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
  ) {
    const data = await this.initialNotesService.getVersions(patientId, id);
    return { data };
  }

  @Get(':id/versions/:versionId')
  @ApiOperation({
    summary: 'Get one Initial Note version with its snapshot — All roles',
  })
  @ApiOkResponse({ description: 'The requested version.' })
  getVersion(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ) {
    return this.initialNotesService.getVersion(patientId, id, versionId);
  }

  @Post()
  @Roles(Role.DOCTOR, Role.ADMIN)
  create(
    @Param('patientId') patientId: string,
    @Body() createInitialNoteDto: CreateInitialNoteDto,
    @Request() req,
  ) {
    return this.initialNotesService.create(
      patientId,
      createInitialNoteDto,
      req.user.id,
    );
  }

  @Patch(':id')
  @UseGuards(AuthorGuard)
  @NoteModel('initialNote')
  update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() updateInitialNoteDto: UpdateInitialNoteDto,
    @Request() req,
  ) {
    return this.initialNotesService.update(
      patientId,
      id,
      updateInitialNoteDto,
      req.user.id,
    );
  }

  @Post(':id/publish')
  @UseGuards(AuthorGuard)
  @NoteModel('initialNote')
  publish(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.initialNotesService.publish(patientId, id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthorGuard)
  @NoteModel('initialNote')
  remove(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.initialNotesService.remove(patientId, id, req.user.id);
  }
}
