import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth,
  ApiCreatedResponse, ApiOkResponse,
} from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Patients')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'List / search all active patients' })
  @ApiOkResponse({ description: 'Paginated patient list.' })
  async findAll(
    @Query('search') search?: string,
    @Query('page')   page?:   number,
    @Query('limit')  limit?:  number,
  ) {
    return this.patientsService.findAll({ search, page, limit });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new patient (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Patient created.' })
  async create(
    @Body() dto: CreatePatientDto,
    @CurrentUser() user: User,
  ) {
    return this.patientsService.create(dto, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single patient with banner data' })
  async findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Update patient demographics (Doctor, Admin)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(id, dto);
  }
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate patient record (Admin only)' })
  async deactivate(@Param('id') id: string) {
    return this.patientsService.deactivate(id);
  }
}
