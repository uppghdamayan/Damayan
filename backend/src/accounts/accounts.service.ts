import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { Role, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService implements OnModuleInit {
  private supabase: ReturnType<typeof createClient>;
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  // ─────────────────────────────────────────────
  // ADMIN SEED — runs once on application startup
  // ─────────────────────────────────────────────

  async onModuleInit() {
    await this.seedAdminAccount();
  }

  async seedAdminAccount() {
    const admins = [
      {
        email: this.configService.get<string>('ADMIN_EMAIL'),
        password: this.configService.get<string>('ADMIN_PASSWORD'),
      },
      {
        email: this.configService.get<string>('ADMIN_EMAIL_2'),
        password: this.configService.get<string>('ADMIN_PASSWORD_2'),
      },
      {
        email: this.configService.get<string>('ADMIN_EMAIL_3'),
        password: this.configService.get<string>('ADMIN_PASSWORD_3'),
      },
    ];

    for (let i = 0; i < admins.length; i++) {
      const adminEmail = admins[i].email;
      const adminPassword = admins[i].password;

      if (!adminEmail || !adminPassword) {
        if (i === 0) {
          this.logger.warn(
            'ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping primary admin seed.',
          );
        }
        continue;
      }

      // Check if this specific Admin already exists in the users table
      const existing = await this.prisma.user.findUnique({
        where: { email: adminEmail },
      });

      if (existing) {
        this.logger.log(
          `Admin account ${adminEmail} already exists. Seed skipped.`,
        );
        continue;
      }

      this.logger.log(`Seeding admin account: ${adminEmail}`);

      let adminUserId: string | undefined;

      const { data: createData, error: createError } =
        await this.supabase.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: { must_change_password: false },
        });

      if (createError) {
        if (createError.message.includes('already been registered')) {
          // Find existing user
          const { data: listData } = await this.supabase.auth.admin.listUsers();
          const existingSupabaseUser = listData?.users.find(
            (u: any) => u.email === adminEmail,
          );
          if (existingSupabaseUser) {
            adminUserId = existingSupabaseUser.id;
          } else {
            this.logger.error(
              `Supabase user exists but could not be found in list for ${adminEmail}.`,
            );
            continue;
          }
        } else {
          this.logger.error(
            `Failed to create Supabase auth user for admin ${adminEmail}: ${createError.message}`,
          );
          continue;
        }
      } else {
        adminUserId = createData.user.id;
      }

      await this.prisma.user.create({
        data: {
          id: adminUserId,
          email: adminEmail,
          firstName: 'System',
          lastName: i === 0 ? 'Admin' : `Admin ${i + 1}`,
          role: Role.ADMIN,
          isActive: true,
        },
      });

      this.logger.log(`Admin account ${adminEmail} seeded successfully.`);
    }
  }

  // ─────────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────────

  async findAll(filters: {
    role?: Role;
    isActive?: boolean;
    page?: number;
    limit?: number;
  }) {
    const { role, isActive, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Account ${id} not found.`);
    return user;
  }

  async create(dto: CreateAccountDto) {
    // Check for existing email in users table
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already in use.');

    // Generate cryptographically random 16-char temp password
    const tempPassword = this.generateTempPassword();

    const { data, error } = await this.supabase.auth.admin.createUser({
      email: dto.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });

    if (error) {
      throw new ConflictException(
        `Supabase account creation failed: ${error.message}`,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        id: data.user.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        role: dto.role,
        isActive: true,
        requiresPasswordChange: true,
        temporaryPassword: tempPassword,
      },
    });

    // Return temp password only once — it is never stored
    return {
      user,
      tempPassword,
      note: 'Temporary password must be shared securely. It will not be shown again.',
    };
  }

  async update(id: string, dto: UpdateAccountDto) {
    await this.findOne(id); // throws if not found
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.middleName !== undefined && { middleName: dto.middleName }),
        ...(dto.role && { role: dto.role }),
      },
    });
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    if (user.role === Role.ADMIN) {
      // Prevent deleting the last Admin
      const adminCount = await this.prisma.user.count({
        where: { role: Role.ADMIN },
      });
      if (adminCount <= 1) {
        throw new ConflictException('Cannot delete the last Admin account.');
      }
    }

    try {
      const deletedUser = await this.prisma.user.delete({
        where: { id },
      });

      const { error } = await this.supabase.auth.admin.deleteUser(id);
      if (error) {
        this.logger.error(
          `Failed to delete Supabase user ${id}: ${error.message}`,
        );
      }

      return deletedUser;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete account because it is referenced by existing medical records.',
        );
      }
      throw error;
    }
  }

  async resetPassword(id: string) {
    const user = await this.findOne(id);

    // Generate cryptographically random 16-char temp password
    const tempPassword = this.generateTempPassword();

    const { error } = await this.supabase.auth.admin.updateUserById(id, {
      password: tempPassword,
      user_metadata: { must_change_password: true },
    });

    if (error) {
      throw new ConflictException(`Failed to reset password: ${error.message}`);
    }

    // Flag user for mandatory password change on next login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        requiresPasswordChange: true,
        temporaryPassword: tempPassword,
      },
    });

    return {
      user,
      tempPassword,
      note: 'Temporary password must be shared securely. It will not be shown again.',
    };
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private generateTempPassword(): string {
    // 16 chars: letters + digits + symbols, guaranteed mixed
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = randomBytes(16);
    return Array.from(bytes)
      .map((b) => chars[b % chars.length])
      .join('');
  }
}
