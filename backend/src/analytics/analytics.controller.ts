import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated analytics for admin dashboard (Admin only)' })
  @ApiOkResponse({ description: 'Dashboard analytics data.' })
  async getDashboard(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateRange = from && to
      ? { from: new Date(from), to: new Date(to) }
      : undefined;
    return this.analyticsService.getDashboard(dateRange);
  }

  @Get('problems')
  @ApiOperation({ summary: 'Paginated list of all diagnoses with patient counts (Admin only)' })
  async getProblems(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateRange = from && to
      ? { from: new Date(from), to: new Date(to) }
      : undefined;
    return this.analyticsService.getProblemsPaginated({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      dateRange,
    });
  }

  @Get('medications')
  @ApiOperation({ summary: 'Paginated list of all medications with patient counts (Admin only)' })
  async getMedications(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const dateRange = from && to
      ? { from: new Date(from), to: new Date(to) }
      : undefined;
    return this.analyticsService.getMedicationsPaginated({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      dateRange,
    });
  }
}
