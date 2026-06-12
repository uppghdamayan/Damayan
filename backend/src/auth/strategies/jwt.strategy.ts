import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

import { passportJwtSecret } from 'jwks-rsa';

export interface JwtPayload {
  sub: string;          // Supabase Auth user UUID
  email: string;
  user_role: string;    // Injected by custom_access_token_hook
  iat: number;
  exp: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${configService.get<string>('SUPABASE_URL')}/auth/v1/api/jwk`,
        requestHeaders: {
          apikey: configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
        },
      }),
      algorithms: ['RS256', 'ES256', 'HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    console.log('JWT validate called with payload:', payload);
    // Verify the user exists and is active in our users table
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Account is inactive or does not exist.');
    }

    return user; // Attached to request as req.user
  }
}
