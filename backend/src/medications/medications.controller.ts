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
import { MedicationsService } from './medications.service';
import { CreateMedicationDto } from './dto/create-medication.dto';
import { UpdateMedicationDto } from './dto/update-medication.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Medications')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/medications')
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  @ApiOperation({ summary: 'List medications for a patient — All roles' })
  @ApiOkResponse({ description: 'Active medications by default; pass includeInactive=true for full history.' })
  async findAll(
    @Param('patientId') patientId: string,
    @Query('includeInactive') includeInactive?: boolean,
  ) {
    const data = await this.medicationsService.findAll(patientId, !!includeInactive);
    return { data };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add medication (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Medication added.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateMedicationDto,
    @CurrentUser() user: User,
  ) {
    return this.medicationsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({ summary: 'Edit medication (Doctor, Admin)' })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.medicationsService.update(patientId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete medication — sets is_active false (Doctor, Admin)' })
  async remove(@Param('patientId') patientId: string, @Param('id') id: string) {
    return this.medicationsService.remove(patientId, id);
  }
}
