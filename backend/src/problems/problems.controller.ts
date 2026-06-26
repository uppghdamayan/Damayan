import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { ReorderProblemsDto } from './dto/reorder-problems.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, User } from '@prisma/client';

@ApiTags('Problems')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard)
@Controller('patients/:patientId/problems')
export class ProblemsController {
  constructor(private readonly problemsService: ProblemsService) {}

  @Get()
  @ApiOperation({
    summary: 'List problem list for a patient, flat & sort-ordered — All roles',
  })
  @ApiOkResponse({
    description: 'Flat list; build the parent/child tree client-side.',
  })
  async findAll(@Param('patientId') patientId: string) {
    const data = await this.problemsService.findAll(patientId);
    return { data };
  }

  @Get('logs')
  @ApiOperation({
    summary: 'List problem logs for a patient — All roles',
  })
  @ApiOkResponse({
    description: 'List of problem logs.',
  })
  async getLogs(@Param('patientId') patientId: string) {
    const data = await this.problemsService.getLogs(patientId);
    return { data };
  }

  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Batch update sort_order after drag-and-drop (Doctor, Admin)',
  })
  async reorder(
    @Param('patientId') patientId: string,
    @Body() dto: ReorderProblemsDto,
    @CurrentUser() user: User,
  ) {
    return this.problemsService.reorder(patientId, dto, user.id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a problem (Doctor, Admin)' })
  @ApiCreatedResponse({ description: 'Problem created.' })
  async create(
    @Param('patientId') patientId: string,
    @Body() dto: CreateProblemDto,
    @CurrentUser() user: User,
  ) {
    return this.problemsService.create(patientId, dto, user.id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Edit problem title, status, or parent (Doctor, Admin)',
  })
  async update(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProblemDto,
    @CurrentUser() user: User,
  ) {
    return this.problemsService.update(patientId, id, dto, user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.DOCTOR, Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft-delete a problem — sets status to REMOVED (Doctor, Admin)',
  })
  async remove(
    @Param('patientId') patientId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.problemsService.remove(patientId, id, user.id);
  }
}
