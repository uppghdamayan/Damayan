import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAuditLogDto): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: dto as any,
      });
    } catch (error) {
      this.logger.error(
        'Failed to create audit log',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(query: QueryAuditLogsDto) {
    const {
      userId,
      patientId,
      action,
      tableName,
      from,
      to,
      page = 1,
      limit = 50,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { action: { not: 'DRAFT' } };
    if (userId) where.userId = userId;
    if (patientId) where.patientId = patientId;
    if (action) where.action = action;
    if (tableName) where.tableName = tableName;

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
