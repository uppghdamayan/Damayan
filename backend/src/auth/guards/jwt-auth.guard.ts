import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.supabase = createClient(
      this.configService.get<string>('SUPABASE_URL')!,
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Securely verify token by fetching the user profile from Supabase Auth
    const { data: { user: supabaseUser }, error } = await this.supabase.auth.getUser(token);

    if (error || !supabaseUser) {
      throw new UnauthorizedException('Invalid token');
    }

    // Verify the user exists and is active in our users table
    const user = await this.prisma.user.findUnique({
      where: { id: supabaseUser.id },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or does not exist.');
    }

    // Attach user to request for @CurrentUser() decorator
    request.user = user;
    return true;
  }
}
