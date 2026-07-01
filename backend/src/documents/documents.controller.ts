import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';
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

  @Post('generate')
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  async generate(
    @Param('patientId') patientId: string,
    @Body() dto: GenerateDocumentDto,
    @Req() req: any,
  ) {
    return this.documentsService.generate(patientId, dto.type, dto.visitId, req.user.id);
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
