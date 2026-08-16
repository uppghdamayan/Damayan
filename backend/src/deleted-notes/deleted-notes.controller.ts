import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { DeletedNotesService } from './deleted-notes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Deleted Notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/deleted-notes')
export class DeletedNotesController {
  constructor(private readonly deletedNotesService: DeletedNotesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all deleted notes for a patient' })
  findAllByPatient(@Param('patientId') patientId: string) {
    return this.deletedNotesService.findAllByPatient(patientId);
  }
}
