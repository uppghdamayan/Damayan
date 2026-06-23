import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    );
  }

  async getMe(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      extension: user.extension,
      role: user.role,
      isActive: user.isActive,
      requiresPasswordChange: user.requiresPasswordChange,
    };
  }

  async changePassword(user: User, dto: ChangePasswordDto) {
    const { error } = await this.supabase.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
      user_metadata: { must_change_password: false },
    });

    if (error) {
      throw new UnauthorizedException(
        `Failed to update password: ${error.message}`,
      );
    }

    // Clear the forced password-change flag and temporary password
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        requiresPasswordChange: false,
        temporaryPassword: null,
      },
    });

    return {
      message: 'Password updated successfully.',
      requiresPasswordChange: false,
    };
  }
}
