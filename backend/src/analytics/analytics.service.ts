import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface DateRange {
  from: Date;
  to: Date;
}

interface PaginatedQuery {
  page: number;
  limit: number;
  search?: string;
  dateRange?: DateRange;
}

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ── Main dashboard aggregation ─────────────────────────────────────────────

  async getDashboard(dateRange?: DateRange) {
    const patientWhere: Prisma.PatientWhereInput = dateRange
      ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
      : {};
    const visitWhere: Prisma.VisitWhereInput = dateRange
      ? { visitDatetime: { gte: dateRange.from, lte: dateRange.to } }
      : {};
    const problemWhere: Prisma.ProblemWhereInput = dateRange
      ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
      : {};
    const medicationWhere: Prisma.MedicationWhereInput = dateRange
      ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
      : {};

    const [
      summary,
      sexDistribution,
      topDiagnoses,
      topMedications,
      patientsByCity,
      patientsByRegion,
      registrationsOverTime,
      visitsOverTime,
      ageDistribution,
      problemStatusBreakdown,
      staffByRole,
    ] = await Promise.all([
      this.getSummary(patientWhere, visitWhere, problemWhere, medicationWhere),
      this.getSexDistribution(patientWhere),
      this.getTopDiagnoses(problemWhere),
      this.getTopMedications(medicationWhere),
      this.getPatientsByCity(patientWhere),
      this.getPatientsByRegion(patientWhere),
      this.getRegistrationsOverTime(patientWhere),
      this.getVisitsOverTime(visitWhere),
      this.getAgeDistribution(patientWhere),
      this.getProblemStatusBreakdown(problemWhere),
      this.getStaffByRole(),
    ]);

    return {
      summary,
      sexDistribution,
      topDiagnoses,
      topMedications,
      patientsByCity,
      patientsByRegion,
      registrationsOverTime,
      visitsOverTime,
      ageDistribution,
      problemStatusBreakdown,
      staffByRole,
    };
  }

  // ── Summary cards ──────────────────────────────────────────────────────────

  private async getSummary(
    patientWhere: Prisma.PatientWhereInput,
    visitWhere: Prisma.VisitWhereInput,
    problemWhere: Prisma.ProblemWhereInput,
    medicationWhere: Prisma.MedicationWhereInput,
  ) {
    const [
      totalPatients,
      activePatients,
      inactivePatients,
      totalVisits,
      totalProblems,
      activeProblems,
      totalMedications,
      activeMedications,
    ] = await Promise.all([
      this.prisma.patient.count({ where: patientWhere }),
      this.prisma.patient.count({ where: { ...patientWhere, isActive: true } }),
      this.prisma.patient.count({
        where: { ...patientWhere, isActive: false },
      }),
      this.prisma.visit.count({ where: visitWhere }),
      this.prisma.problem.count({ where: problemWhere }),
      this.prisma.problem.count({
        where: { ...problemWhere, status: 'ACTIVE' },
      }),
      this.prisma.medication.count({ where: medicationWhere }),
      this.prisma.medication.count({
        where: { ...medicationWhere, isActive: true },
      }),
    ]);

    return {
      totalPatients,
      activePatients,
      inactivePatients,
      totalVisits,
      totalProblems,
      activeProblems,
      totalMedications,
      activeMedications,
    };
  }

  // ── Sex distribution ───────────────────────────────────────────────────────

  private async getSexDistribution(patientWhere: Prisma.PatientWhereInput) {
    const result = await this.prisma.patient.groupBy({
      by: ['sex'],
      _count: { sex: true },
      where: patientWhere,
    });
    return result.map((r) => ({ sex: r.sex, count: r._count.sex }));
  }

  // ── Top 10 diagnoses ──────────────────────────────────────────────────────

  private async getTopDiagnoses(problemWhere: Prisma.ProblemWhereInput) {
    const result = await this.prisma.problem.groupBy({
      by: ['title'],
      _count: { title: true },
      where: { ...problemWhere, status: 'ACTIVE' },
      orderBy: { _count: { title: 'desc' } },
      take: 10,
    });
    return result.map((r) => ({ name: r.title, count: r._count.title }));
  }

  // ── Top 10 medications ─────────────────────────────────────────────────────

  private async getTopMedications(
    medicationWhere: Prisma.MedicationWhereInput,
  ) {
    const result = await this.prisma.medication.groupBy({
      by: ['name'],
      _count: { name: true },
      where: { ...medicationWhere, isActive: true },
      orderBy: { _count: { name: 'desc' } },
      take: 10,
    });
    return result.map((r) => ({ name: r.name, count: r._count.name }));
  }

  // ── Patients by city ──────────────────────────────────────────────────────

  private async getPatientsByCity(patientWhere: Prisma.PatientWhereInput) {
    const result = await this.prisma.patient.groupBy({
      by: ['addressCity'],
      _count: { addressCity: true },
      where: { ...patientWhere, addressCity: { not: null } },
      orderBy: { _count: { addressCity: 'desc' } },
      take: 15,
    });
    return result.map((r) => ({
      city: r.addressCity || 'Unknown',
      count: r._count.addressCity,
    }));
  }

  // ── Patients by region ─────────────────────────────────────────────────────

  private async getPatientsByRegion(patientWhere: Prisma.PatientWhereInput) {
    const result = await this.prisma.patient.groupBy({
      by: ['addressRegion'],
      _count: { addressRegion: true },
      where: { ...patientWhere, addressRegion: { not: null } },
      orderBy: { _count: { addressRegion: 'desc' } },
      take: 15,
    });
    return result.map((r) => ({
      region: r.addressRegion || 'Unknown',
      count: r._count.addressRegion,
    }));
  }

  // ── Patient registrations over time (monthly) ──────────────────────────────

  private async getRegistrationsOverTime(
    patientWhere: Prisma.PatientWhereInput,
  ) {
    // Use raw query for date_trunc which is more reliable for monthly grouping
    const dateFilter = (patientWhere as any)?.createdAt;
    let whereClause = '';
    const params: any[] = [];

    if (dateFilter?.gte && dateFilter?.lte) {
      whereClause = 'WHERE created_at >= $1 AND created_at <= $2';
      params.push(dateFilter.gte, dateFilter.lte);
    }

    const result = await this.prisma.$queryRawUnsafe<
      { month: Date; count: bigint }[]
    >(
      `SELECT date_trunc('month', created_at) as month, COUNT(*)::bigint as count
       FROM patients ${whereClause}
       GROUP BY month
       ORDER BY month ASC`,
      ...params,
    );

    return result.map((r) => ({
      month: r.month.toISOString().slice(0, 7), // "2025-01"
      count: Number(r.count),
    }));
  }

  // ── Visits over time (monthly) ─────────────────────────────────────────────

  private async getVisitsOverTime(visitWhere: Prisma.VisitWhereInput) {
    const dateFilter = (visitWhere as any)?.visitDatetime;
    let whereClause = '';
    const params: any[] = [];

    if (dateFilter?.gte && dateFilter?.lte) {
      whereClause = 'WHERE visit_datetime >= $1 AND visit_datetime <= $2';
      params.push(dateFilter.gte, dateFilter.lte);
    }

    const result = await this.prisma.$queryRawUnsafe<
      { month: Date; count: bigint }[]
    >(
      `SELECT date_trunc('month', visit_datetime) as month, COUNT(*)::bigint as count
       FROM visits ${whereClause}
       GROUP BY month
       ORDER BY month ASC`,
      ...params,
    );

    return result.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      count: Number(r.count),
    }));
  }

  // ── Age distribution ───────────────────────────────────────────────────────

  private async getAgeDistribution(patientWhere: Prisma.PatientWhereInput) {
    const dateFilter = (patientWhere as any)?.createdAt;
    let whereClause = '';
    const params: any[] = [];

    if (dateFilter?.gte && dateFilter?.lte) {
      whereClause = 'WHERE created_at >= $1 AND created_at <= $2';
      params.push(dateFilter.gte, dateFilter.lte);
    }

    const result = await this.prisma.$queryRawUnsafe<
      { range: string; count: bigint }[]
    >(
      `SELECT
        CASE
          WHEN EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 31 AND 45 THEN '31-45'
          WHEN EXTRACT(YEAR FROM AGE(NOW(), date_of_birth)) BETWEEN 46 AND 60 THEN '46-60'
          ELSE '60+'
        END as range,
        COUNT(*)::bigint as count
       FROM patients ${whereClause}
       GROUP BY range
       ORDER BY range ASC`,
      ...params,
    );

    // Ensure all buckets exist even if count is 0
    const buckets = ['0-17', '18-30', '31-45', '46-60', '60+'];
    const map = new Map(result.map((r) => [r.range, Number(r.count)]));
    return buckets.map((range) => ({ range, count: map.get(range) || 0 }));
  }

  // ── Problem status breakdown ───────────────────────────────────────────────

  private async getProblemStatusBreakdown(
    problemWhere: Prisma.ProblemWhereInput,
  ) {
    const result = await this.prisma.problem.groupBy({
      by: ['status'],
      _count: { status: true },
      where: problemWhere,
    });
    return result.map((r) => ({ status: r.status, count: r._count.status }));
  }

  // ── Staff by role ──────────────────────────────────────────────────────────

  private async getStaffByRole() {
    const result = await this.prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
      where: { isActive: true },
    });
    return result.map((r) => ({ role: r.role, count: r._count.role }));
  }

  // ── Paginated problems (full list) ─────────────────────────────────────────

  async getProblemsPaginated(query: PaginatedQuery) {
    const { page, limit, search, dateRange } = query;

    const problemWhere: Prisma.ProblemWhereInput = { status: 'ACTIVE' };
    if (dateRange) {
      problemWhere.createdAt = { gte: dateRange.from, lte: dateRange.to };
    }
    if (search) {
      problemWhere.title = { contains: search, mode: 'insensitive' };
    }

    // Get all matching titles grouped with count
    const allGrouped = await this.prisma.problem.groupBy({
      by: ['title'],
      _count: { title: true },
      where: problemWhere,
      orderBy: { _count: { title: 'desc' } },
    });

    // Filter by search if needed (already done in where, but title grouping
    // may have subtleties) and paginate in memory since Prisma groupBy doesn't
    // support skip/take together with orderBy on aggregates reliably across all
    // versions. For analytics counts this is fine — the number of unique problem
    // titles is bounded.
    const total = allGrouped.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = allGrouped.slice(start, start + limit).map((r) => ({
      name: r.title,
      count: r._count.title,
    }));

    return { data, meta: { total, page, limit, totalPages } };
  }

  // ── Paginated medications (full list) ──────────────────────────────────────

  async getMedicationsPaginated(query: PaginatedQuery) {
    const { page, limit, search, dateRange } = query;

    const medWhere: Prisma.MedicationWhereInput = { isActive: true };
    if (dateRange) {
      medWhere.createdAt = { gte: dateRange.from, lte: dateRange.to };
    }
    if (search) {
      medWhere.name = { contains: search, mode: 'insensitive' };
    }

    const allGrouped = await this.prisma.medication.groupBy({
      by: ['name'],
      _count: { name: true },
      where: medWhere,
      orderBy: { _count: { name: 'desc' } },
    });

    const total = allGrouped.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = allGrouped.slice(start, start + limit).map((r) => ({
      name: r.name,
      count: r._count.name,
    }));

    return { data, meta: { total, page, limit, totalPages } };
  }

  // ── Patient Analytics (Cross-Section) ──────────────────────────────────────

  async getPatientsAnalyticsPaginated(params: {
    page: number;
    limit: number;
    search?: string;
    diagnosis?: string;
    medication?: string;
    city?: string;
    region?: string;
    dateRange?: DateRange;
  }) {
    const {
      page,
      limit,
      search,
      diagnosis,
      medication,
      city,
      region,
      dateRange,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.PatientWhereInput = {};
    const andFilters: Prisma.PatientWhereInput[] = [];

    if (search) {
      andFilters.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { patientCode: { contains: search, mode: 'insensitive' } },
        ],
      });
    }

    if (diagnosis) {
      andFilters.push({
        problems: {
          some: {
            title: { contains: diagnosis, mode: 'insensitive' },
          },
        },
      });
    }

    if (medication) {
      andFilters.push({
        medications: {
          some: {
            name: { contains: medication, mode: 'insensitive' },
          },
        },
      });
    }

    if (city) {
      andFilters.push({ addressCity: { contains: city, mode: 'insensitive' } });
    }

    if (region) {
      andFilters.push({
        addressRegion: { contains: region, mode: 'insensitive' },
      });
    }

    if (dateRange) {
      andFilters.push({
        createdAt: { gte: dateRange.from, lte: dateRange.to },
      });
    }

    if (andFilters.length > 0) {
      where.AND = andFilters;
    }

    const [data, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          problems: {
            where: diagnosis
              ? { title: { contains: diagnosis, mode: 'insensitive' } }
              : undefined,
            take: 3,
          },
          medications: {
            where: medication
              ? { name: { contains: medication, mode: 'insensitive' } }
              : undefined,
            take: 3,
          },
        },
      }),
      this.prisma.patient.count({ where }),
    ]);

    const formattedData = data.map((p) => ({
      id: p.id,
      patientCode: p.patientCode,
      name: `${p.firstName} ${p.lastName}`,
      sex: p.sex,
      dateOfBirth: p.dateOfBirth,
      city: p.addressCity || 'N/A',
      region: p.addressRegion || 'N/A',
      diagnoses: p.problems.map((prob) => prob.title),
      medications: p.medications.map((med) => med.name),
      createdAt: p.createdAt,
    }));

    return {
      data: formattedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
