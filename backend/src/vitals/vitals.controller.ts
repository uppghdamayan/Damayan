import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { VitalsService } from './vitals.service';
import { CreateVitalsDto } from './dto/create-vitals.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Vitals')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/vitals')
export class VitalsController {
  constructor(private readonly vitalsService: VitalsService) {}

  @Get()
  @ApiOperation({ summary: 'List vital signs history for a patient, newest first — All roles' })
  @ApiOkResponse({ description: 'Paginated vitals history.' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.vitalsService.findAll(patientId, Number(page) || 1, Number(limit) || 10);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get the single most recent vital signs record — All roles' })
  @ApiOkResponse({ description: 'Latest vitals record, or null if none recorded.' })
  async findLatest(@Param('patientId') patientId: string) {
    return this.vitalsService.findLatest(patientId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record vital signs (Doctor, Nurse, Admin)' })
  @ApiCreatedResponse({ description: 'Vitals record created.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateVitalsDto,
    @CurrentUser() user: User,
  ) {
    return this.vitalsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.NURSE, Role.ADMIN)
  @ApiOperation({ summary: 'Edit a vital signs record (Doctor, Nurse, Admin)' })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVitalsDto,
  ) {
    return this.vitalsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a vital signs record (Doctor, Admin — Nurse cannot delete)' })
  async remove(@Param('patientId') patientId: string, @Param('id') id: string) {
    return this.vitalsService.remove(patientId, id);
  }
}
