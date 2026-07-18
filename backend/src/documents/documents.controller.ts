import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';
import { DocumentDraftQueryDto } from './dto/document-draft-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('patients/:patientId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async findAll(@Param('patientId') patientId: string) {
    return this.documentsService.findByPatient(patientId);
  }

  @Get('draft')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async draft(
    @Param('patientId') patientId: string,
    @Query() query: DocumentDraftQueryDto,
    @Req() req: any,
  ) {
    return this.documentsService.buildDraft(
      patientId,
      query.type,
      query.visitId,
      req.user.id,
    );
  }

  @Post('generate')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async generate(
    @Param('patientId') patientId: string,
    @Body() dto: GenerateDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.generate(patientId, dto, req.user.id);
  }

  @Get(':id/download')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async download(@Param('id') id: string) {
    return this.documentsService.getDownloadUrl(id);
  }

  @Delete(':id')
  @Roles(Role.DOCTOR, Role.ADMIN)
  async remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
