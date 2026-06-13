import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VisitsService } from './visits.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Visits')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Get()
  @ApiOperation({ summary: 'List visits for a patient (newest first)' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('page')      page?:      number,
    @Query('limit')     limit?:     number,
  ) {
    return this.visitsService.findAllByPatient(patientId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single visit with note summary' })
  async findOne(@Param('id') id: string) {
    return this.visitsService.findOne(id);
  }
}
