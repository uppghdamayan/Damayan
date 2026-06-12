# DAMAYAN EMR — Phase 3: Authentication, RBAC & Admin Provisioning

**Dependency:** Phase 2 complete (Prisma schema migrated, all tables exist in Supabase)
**Deliverables:** Supabase JWT hook, working NestJS auth guards, seeded Admin account, functional `/login` and `/admin` frontend flows

---

## Overview

Phase 3 wires Supabase Auth to the NestJS backend and builds the first usable UI: the Admin provisioning panel. When complete, the Admin can log in, see all user accounts, and create Doctor/Nurse accounts that are immediately ready to use. No other screens are built yet — those come in Phase 4+.

**What gets built:**

- Supabase config: disable public signups, custom JWT hook to inject `role` claim
- Backend: `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `CurrentUser` decorator
- Backend: Full `AuthService` + `AccountsService` with `seedAdminAccount()` on startup
- Backend: All endpoints stubbed in Phase 1 are now fully implemented for Auth + Accounts modules
- Frontend: `/login` page with Supabase client auth
- Frontend: `/admin` workspace — `AccountsTable` + `CreateAccountModal`
- Frontend: Route protection middleware using Supabase session

---

## Part 1 — Supabase Configuration

### 1.1 Disable Public Sign-Ups

In the Supabase Dashboard → Authentication → Providers → Email:
- Set **Enable Email Signups** to `OFF`
- This ensures only `supabase.auth.admin.createUser()` (service-role key) can create accounts

### 1.2 Custom Access Token Hook (PostgreSQL)

This hook runs on every token mint and injects the user's `role` from `public.users` into the JWT so the NestJS backend can read it without a database lookup per request.

Run in Supabase SQL Editor:

```sql
-- Create the hook function
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  -- Fetch role from public.users using the Supabase Auth user ID
  SELECT role::text INTO user_role
  FROM public.users
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute permission to the supabase_auth_admin role
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;

-- Grant SELECT on users table to supabase_auth_admin
GRANT SELECT ON public.users TO supabase_auth_admin;
```

Then in Supabase Dashboard → Authentication → Hooks:
- Enable **Custom Access Token Hook**
- Set the function to `public.custom_access_token_hook`

**Verify the hook** by inspecting a JWT after login at [jwt.io](https://jwt.io) — it should contain `"user_role": "ADMIN"` (or DOCTOR / NURSE) in the payload.

---

## Part 2 — Backend: Environment Variables

Add the following to `backend/.env` (reference `backend/.env.example`):

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-supabase-jwt-secret
PORT=3001

# Admin seed credentials (used once on startup to bootstrap the first Admin)
ADMIN_EMAIL=admin@damayan.ph
ADMIN_PASSWORD=ChangeMe!2024Secure
```

`JWT_SECRET` is the **JWT Secret** found in Supabase Dashboard → Project Settings → API → JWT Settings. This is used by `passport-jwt` to verify token signatures without a network call.

---

## Part 3 — Backend: Auth Infrastructure

### 3.1 Install Required Packages

```bash
cd backend
npm install @nestjs/passport @nestjs/jwt passport passport-jwt
npm install --save-dev @types/passport-jwt
```

### 3.2 File: `src/auth/strategies/jwt.strategy.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

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
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
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
```

### 3.3 File: `src/auth/guards/jwt-auth.guard.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

### 3.4 File: `src/auth/guards/roles.guard.ts`

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator means the route only requires a valid JWT (any role)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

### 3.5 File: `src/auth/decorators/roles.decorator.ts`

```typescript
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### 3.6 File: `src/auth/decorators/current-user.decorator.ts`

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

### 3.7 File: `src/auth/dto/change-password.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewSecure!Pass2024' })
  @IsString()
  @MinLength(12)
  newPassword: string;
}
```

### 3.8 File: `src/auth/auth.service.ts`

```typescript
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
    };
  }

  async changePassword(user: User, dto: ChangePasswordDto) {
    const { error } = await this.supabase.auth.admin.updateUserById(user.id, {
      password: dto.newPassword,
    });

    if (error) {
      throw new UnauthorizedException(`Failed to update password: ${error.message}`);
    }

    return { message: 'Password updated successfully.' };
  }
}
```

### 3.9 Update `src/auth/auth.controller.ts`

Replace the stub controller fully:

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Get current user profile from JWT' })
  @ApiOkResponse({ description: 'Returns the authenticated user profile.' })
  async getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change own password (authenticated user)' })
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user, dto);
  }
}
```

### 3.10 Update `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

---

## Part 4 — Backend: Accounts Module (Full Implementation)

### 4.1 File: `src/accounts/accounts.service.ts`

```typescript
import {
  Injectable,
  ConflictException,
  NotFoundException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Role } from '@prisma/client';
import { randomBytes } from 'crypto';

@Injectable()
export class AccountsService implements OnModuleInit {
  private supabase: SupabaseClient;
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
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    const adminPassword = this.configService.get<string>('ADMIN_PASSWORD');

    if (!adminEmail || !adminPassword) {
      this.logger.warn('ADMIN_EMAIL or ADMIN_PASSWORD not set. Skipping admin seed.');
      return;
    }

    // Check if an Admin already exists in the users table
    const existing = await this.prisma.user.findFirst({
      where: { role: Role.ADMIN },
    });

    if (existing) {
      this.logger.log('Admin account already exists. Seed skipped.');
      return;
    }

    this.logger.log(`Seeding admin account: ${adminEmail}`);

    const { data, error } = await this.supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { must_change_password: false },
    });

    if (error) {
      this.logger.error(`Failed to create Supabase auth user for admin: ${error.message}`);
      return;
    }

    await this.prisma.user.create({
      data: {
        id: data.user.id,
        email: adminEmail,
        firstName: 'System',
        lastName: 'Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    this.logger.log('Admin account seeded successfully.');
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

    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
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
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
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
      throw new ConflictException(`Supabase account creation failed: ${error.message}`);
    }

    const user = await this.prisma.user.create({
      data: {
        id: data.user.id,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        middleName: dto.middleName,
        role: dto.role as unknown as Role,
        isActive: true,
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
        ...(dto.role && { role: dto.role as unknown as Role }),
      },
    });
  }

  async deactivate(id: string) {
    const user = await this.findOne(id);
    if (user.role === Role.ADMIN) {
      // Prevent deactivating the last Admin
      const adminCount = await this.prisma.user.count({ where: { role: Role.ADMIN, isActive: true } });
      if (adminCount <= 1) {
        throw new ConflictException('Cannot deactivate the last active Admin account.');
      }
    }

    // Disable Supabase Auth login by applying an effectively permanent ban
    await this.supabase.auth.admin.updateUserById(id, {
      ban_duration: '876600h', // 100 years
    });

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  private generateTempPassword(): string {
    // 16 chars: letters + digits + symbols, guaranteed mixed
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const bytes = randomBytes(16);
    return Array.from(bytes).map((b) => chars[b % chars.length]).join('');
  }
}
```

### 4.2 File: `src/accounts/dto/update-account.dto.ts`

```typescript
import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountRole } from './create-account.dto';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Maria' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Cruz' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiPropertyOptional({ enum: AccountRole })
  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;
}
```

### 4.3 Update `src/accounts/accounts.controller.ts`

Replace the stub fully:

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Accounts')
@ApiBearerAuth('access_token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @ApiOperation({ summary: 'List all user accounts (Admin only)' })
  @ApiOkResponse({ description: 'Paginated list of accounts.' })
  async findAll(
    @Query('role') role?: Role,
    @Query('is_active') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.accountsService.findAll({ role, isActive, page, limit });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user account (Admin only)' })
  @ApiCreatedResponse({ description: 'Account created; temp password returned once.' })
  async create(@Body() dto: CreateAccountDto) {
    return this.accountsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single account profile (Admin only)' })
  async findOne(@Param('id') id: string) {
    return this.accountsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account name or role (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accountsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate account (Admin only)' })
  async deactivate(@Param('id') id: string) {
    return this.accountsService.deactivate(id);
  }
}
```

### 4.4 Update `src/accounts/accounts.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
```

---

## Part 5 — Backend: Apply Global Guards

The `JwtAuthGuard` and `RolesGuard` should be applied per-controller (not globally) so the root `GET /` health check remains unauthenticated. The stub modules for Patients, Visits, etc. do not need guards yet — those are added in their respective phases.

Verify `src/main.ts` has the global `ValidationPipe` already configured (it does per the existing file). No changes needed to `main.ts`.

---

## Part 6 — Backend: Verify Startup

```bash
cd backend
npm run start:dev
```

Expected console output:
```
✓ Prisma connected to Supabase
Admin account already exists. Seed skipped.   ← (or "Seeding admin account: ...")
✓ DAMAYAN API running   → http://localhost:3001
✓ Swagger docs          → http://localhost:3001/api
```

Open `http://localhost:3001/api` and verify:
- `GET /auth/me` requires a bearer token (401 without one)
- `GET /accounts` requires a bearer token AND Admin role (403 with wrong role)
- `POST /accounts` is documented with all required fields

---

## Part 7 — Frontend: Login Page

### 7.1 Supabase Client Setup

**File: `frontend/src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export const createSupabaseClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
```

**File: `frontend/src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const createSupabaseServerClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );
};
```

### 7.2 Route Protection Middleware

**File: `frontend/src/middleware.ts`** (at the root of `src/`)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith('/login');
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard');

  if (!session && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/login', '/admin/:path*', '/dashboard/:path*'],
};
```

### 7.3 Auth Store (Zustand)

**File: `frontend/src/stores/authStore.ts`**

```typescript
import { create } from 'zustand';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setUser: (user: AuthUser | null) => void;
  setAccessToken: (token: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clear: () => set({ user: null, accessToken: null }),
}));
```

### 7.4 Login Page

**File: `frontend/src/app/login/page.tsx`**

Design tokens per `design-standard.md`:
- Background: `--bg` (`#F0F2F5`)
- Card: `--surface` (`#FFFFFF`), `border-radius: 8px`, `box-shadow: 0 4px 12px rgba(0,0,0,0.05)`
- Primary button: `--accent` (`#0A6E5F`)
- Font: IBM Plex Sans (add to `layout.tsx` if not already there)

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setAccessToken } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createSupabaseClient();

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.session) {
      setError(authError?.message || 'Login failed. Check your credentials.');
      setLoading(false);
      return;
    }

    // Fetch user profile from the backend using the JWT
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });

    if (!res.ok) {
      setError('Account is inactive or not found. Contact your administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const profile = await res.json();
    setUser(profile);
    setAccessToken(data.session.access_token);

    // Route by role
    if (profile.role === 'ADMIN') {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F0F2F5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #D1D5E0',
          borderRadius: 8,
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          padding: '40px 36px',
          width: '100%',
          maxWidth: 400,
        }}
      >
        {/* Logo + App name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: '#0A6E5F',
              borderRadius: 6,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 18, fontWeight: 700, color: '#0D1117', letterSpacing: '-0.3px' }}>
            DAMAYAN
          </span>
        </div>

        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', marginBottom: 4 }}>
          Sign in to your account
        </h1>
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 24 }}>
          Use the credentials provided by your administrator.
        </p>

        {/* Email field */}
        <div style={{ marginBottom: 14 }}>
          <label
            htmlFor="email"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@damayan.ph"
            style={{
              height: 34,
              width: '100%',
              padding: '0 10px',
              background: '#FFFFFF',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 13,
              color: '#0D1117',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0A6E5F';
              e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5E0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Password field */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="password"
            style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            style={{
              height: 34,
              width: '100%',
              padding: '0 10px',
              background: '#FFFFFF',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 13,
              color: '#0D1117',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#0A6E5F';
              e.target.style.boxShadow = '0 0 0 3px rgba(10,110,95,0.12)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#D1D5E0';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p style={{ fontSize: 12, color: '#991B1B', marginBottom: 14 }}>
            {error}
          </p>
        )}

        {/* Submit button */}
        <button
          onClick={handleLogin}
          disabled={loading || !email || !password}
          style={{
            height: 34,
            width: '100%',
            background: loading ? '#085A4E' : '#0A6E5F',
            color: '#FFFFFF',
            border: '1px solid #085A4E',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <p style={{ marginTop: 20, fontSize: 11, color: '#6B7280', textAlign: 'center' }}>
          Accounts are provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}
```

---

## Part 8 — Frontend: Admin Panel

### 8.1 Folder Structure for Admin

```
frontend/src/app/admin/
  layout.tsx           ← Admin shell layout (topbar only, no patient sidebar)
  page.tsx             ← Default redirect to /admin/accounts
  accounts/
    page.tsx           ← AccountsTable + CreateAccountModal
```

### 8.2 API Client Helper

**File: `frontend/src/lib/api.ts`**

```typescript
import { useAuthStore } from '@/stores/authStore';

const BASE = process.env.NEXT_PUBLIC_API_URL;

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().accessToken;

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}
```

### 8.3 Admin Layout

**File: `frontend/src/app/admin/layout.tsx`**

Design tokens applied: topbar height 56px, `--surface`, `--border`, role pill per design-standard.md Section 5.1.

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, clear } = useAuthStore();

  const handleSignOut = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    clear();
    router.push('/login');
  };

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'AD';

  return (
    <div style={{ minHeight: '100vh', background: '#F0F2F5', fontFamily: "'IBM Plex Sans', sans-serif" }}>

      {/* Topbar */}
      <header
        style={{
          height: 56,
          background: '#FFFFFF',
          borderBottom: '1px solid #D1D5E0',
          display: 'flex',
          alignItems: 'center',
          padding: '0 20px',
          gap: 12,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <div style={{ width: 22, height: 22, background: '#0A6E5F', borderRadius: 5 }} />
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0D1117' }}>DAMAYAN</span>

        {/* Role pill */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            background: '#D4EDE9',
            color: '#0A6E5F',
            border: '1px solid #0A6E5F',
            borderRadius: 20,
            padding: '2px 8px',
          }}
        >
          {user?.role ?? 'Admin'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* User avatar */}
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#085A4E',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {initials}
          </div>

          {/* Sign out button */}
          <button
            onClick={handleSignOut}
            style={{
              height: 28,
              padding: '0 12px',
              background: '#F7F8FA',
              border: '1px solid #D1D5E0',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: '#374151',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main */}
      <main style={{ padding: '24px 20px', maxWidth: 1200, margin: '0 auto' }}>
        {children}
      </main>
    </div>
  );
}
```

### 8.4 Accounts Page (Table + Modal)

**File: `frontend/src/app/admin/accounts/page.tsx`**

This is the primary Admin interface. It implements `AccountsTable` and `CreateAccountModal` inline. Design reference: Section 6.5 Tables, Section 6.3 Badges, Section 6.7 Modals, Section 6.2 Buttons.

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '@/lib/api';

interface Account {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  role: 'DOCTOR' | 'NURSE' | 'ADMIN';
  isActive: boolean;
  createdAt: string;
}

interface AccountsResponse {
  data: Account[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface CreateResult {
  user: Account;
  tempPassword: string;
  note: string;
}

// ─── Badge ────────────────────────────────────
const roleBadgeStyle = (role: string): React.CSSProperties => {
  const map: Record<string, React.CSSProperties> = {
    ADMIN:  { background: '#EDE9FE', color: '#4C1D95', border: '1px solid #8B5CF6' },
    DOCTOR: { background: '#D4EDE9', color: '#085A4E', border: '1px solid #0A6E5F' },
    NURSE:  { background: '#DBEAFE', color: '#1E3A8A', border: '1px solid #3B82F6' },
  };
  return {
    ...( map[role] ?? {}),
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    padding: '2px 6px',
    borderRadius: 4,
    display: 'inline-block',
  };
};

const statusBadgeStyle = (isActive: boolean): React.CSSProperties => isActive
  ? { background: '#DCFCE7', color: '#14532D', border: '1px solid #22C55E', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }
  : { background: '#F7F8FA', color: '#6B7280', border: '1px solid #D1D5E0', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', padding: '2px 6px', borderRadius: 4, display: 'inline-block' };

// ─── Button ───────────────────────────────────
const PrimaryBtn = ({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      height: 28,
      padding: '0 14px',
      background: disabled ? '#6B7280' : '#0A6E5F',
      color: '#FFFFFF',
      border: `1px solid ${disabled ? '#6B7280' : '#085A4E'}`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: '0 2px 4px rgba(10,110,95,0.15)',
      flexShrink: 0,
    }}
  >
    {children}
  </button>
);

const SecBtn = ({ children, onClick, danger = false }: { children: React.ReactNode; onClick?: () => void; danger?: boolean }) => (
  <button
    onClick={onClick}
    style={{
      height: 28,
      padding: '0 12px',
      background: danger ? '#FEE2E2' : '#F7F8FA',
      color: danger ? '#991B1B' : '#374151',
      border: `1px solid ${danger ? '#EF4444' : '#D1D5E0'}`,
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 600,
      cursor: 'pointer',
    }}
  >
    {children}
  </button>
);

// ─── Field ────────────────────────────────────
const Field = ({
  label, required = false, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
      {label} {required && <span style={{ color: '#991B1B' }}>*</span>}
    </label>
    {children}
  </div>
);

const inputStyle: React.CSSProperties = {
  height: 34, width: '100%', padding: '0 10px',
  background: '#FFFFFF', border: '1px solid #D1D5E0',
  borderRadius: 6, fontSize: 13, color: '#0D1117',
  outline: 'none', boxSizing: 'border-box',
};

// ─── Modal ────────────────────────────────────
function CreateAccountModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateResult) => void;
}) {
  const [form, setForm] = useState({ email: '', firstName: '', lastName: '', middleName: '', role: 'DOCTOR' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required.';
    if (!form.firstName || form.firstName.length < 2) e.firstName = 'First name must be at least 2 characters.';
    if (!form.lastName || form.lastName.length < 2) e.lastName = 'Last name must be at least 2 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await apiRequest<CreateResult>('/accounts', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          middleName: form.middleName || undefined,
          role: form.role,
        }),
      });
      onCreated(result);
      onClose();
      setForm({ email: '', firstName: '', lastName: '', middleName: '', role: 'DOCTOR' });
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: 10, maxWidth: 520, width: '100%',
          margin: '0 16px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        {/* Modal header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #D1D5E0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0D1117' }}>Create User Account</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#6B7280', lineHeight: 1 }}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* Modal body */}
        <div style={{ padding: '16px 20px' }}>
          {errors.submit && (
            <div style={{ background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: '#991B1B' }}>
              {errors.submit}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="First Name" required>
              <input style={{ ...inputStyle, borderColor: errors.firstName ? '#EF4444' : '#D1D5E0' }} value={form.firstName} onChange={set('firstName')} maxLength={30} />
              {errors.firstName && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.firstName}</p>}
            </Field>
            <Field label="Last Name" required>
              <input style={{ ...inputStyle, borderColor: errors.lastName ? '#EF4444' : '#D1D5E0' }} value={form.lastName} onChange={set('lastName')} maxLength={30} />
              {errors.lastName && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.lastName}</p>}
            </Field>
          </div>

          <Field label="Middle Name">
            <input style={inputStyle} value={form.middleName} onChange={set('middleName')} maxLength={30} placeholder="Optional" />
          </Field>

          <Field label="Email Address" required>
            <input style={{ ...inputStyle, borderColor: errors.email ? '#EF4444' : '#D1D5E0' }} type="email" value={form.email} onChange={set('email')} />
            {errors.email && <p style={{ fontSize: 12, color: '#991B1B', marginTop: 4 }}>{errors.email}</p>}
          </Field>

          <Field label="Role" required>
            <select
              value={form.role}
              onChange={set('role')}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
            >
              <option value="DOCTOR">Doctor</option>
              <option value="NURSE">Nurse</option>
            </select>
          </Field>

          <p style={{ fontSize: 11, color: '#6B7280', marginTop: -6 }}>
            A 16-character temporary password will be generated. Share it securely — it is shown only once.
          </p>
        </div>

        {/* Modal footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #D1D5E0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <SecBtn onClick={onClose}>Cancel</SecBtn>
          <PrimaryBtn onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </PrimaryBtn>
        </div>
      </div>
    </div>
  );
}

// ─── Temp Password Display ───────────────────
function TempPasswordToast({ result, onDismiss }: { result: CreateResult; onDismiss: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
        background: '#FFFFFF', border: '1px solid #22C55E', borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '16px 20px',
        maxWidth: 380,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#14532D' }}>Account created</span>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <p style={{ fontSize: 12, color: '#374151', marginBottom: 10 }}>
        {result.user.firstName} {result.user.lastName} ({result.user.role}) — {result.user.email}
      </p>
      <div style={{ background: '#F7F8FA', border: '1px solid #D1D5E0', borderRadius: 6, padding: '8px 12px', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 4 }}>
          Temporary Password (shown once)
        </p>
        <code style={{ fontSize: 15, fontWeight: 700, color: '#0D1117', fontFamily: "'IBM Plex Mono', monospace" }}>
          {result.tempPassword}
        </code>
      </div>
      <p style={{ fontSize: 11, color: '#6B7280' }}>{result.note}</p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────
export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tempResult, setTempResult] = useState<CreateResult | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await apiRequest<AccountsResponse>(`/accounts?page=${page}&limit=20`);
      setAccounts(res.data);
      setMeta(res.meta);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this account? The user will lose access immediately.')) return;
    setDeactivatingId(id);
    try {
      await apiRequest(`/accounts/${id}`, { method: 'DELETE' });
      fetchAccounts(meta.page);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleCreated = (result: CreateResult) => {
    setTempResult(result);
    fetchAccounts();
    setTimeout(() => setTempResult(null), 60000); // auto-dismiss after 1 min
  };

  return (
    <>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0D1117', marginBottom: 4 }}>User Accounts</h1>
          <p style={{ fontSize: 12, color: '#6B7280' }}>
            {meta.total} account{meta.total !== 1 ? 's' : ''} total
          </p>
        </div>
        <PrimaryBtn onClick={() => setModalOpen(true)}>+ New Account</PrimaryBtn>
      </div>

      {/* Accounts table card */}
      <div style={{ background: '#FFFFFF', border: '1px solid #D1D5E0', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {/* Card header */}
        <div style={{ background: '#F7F8FA', borderBottom: '1px solid #D1D5E0', padding: '10px 14px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}>
            All Accounts
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Loading…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F7F8FA' }}>
                {['Name', 'Email', 'Role', 'Status', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151', borderBottom: '1px solid #D1D5E0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((account, i) => (
                <tr
                  key={account.id}
                  style={{ borderBottom: i < accounts.length - 1 ? '1px solid #D1D5E0' : 'none' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#EFF1F5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151', fontWeight: 500 }}>
                    {account.lastName}, {account.firstName}
                    {account.middleName ? ` ${account.middleName[0]}.` : ''}
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: '#374151' }}>
                    {account.email}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={roleBadgeStyle(account.role)}>{account.role}</span>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <span style={statusBadgeStyle(account.isActive)}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 10px', fontSize: 11, color: '#6B7280', fontFamily: "'IBM Plex Mono', monospace" }}>
                    {new Date(account.createdAt).toLocaleDateString('en-PH')}
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    {account.isActive && account.role !== 'ADMIN' && (
                      <SecBtn
                        onClick={() => handleDeactivate(account.id)}
                        danger
                      >
                        {deactivatingId === account.id ? 'Deactivating…' : 'Deactivate'}
                      </SecBtn>
                    )}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', fontSize: 13, color: '#6B7280' }}>
                    No accounts found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {meta.totalPages > 1 && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid #D1D5E0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => fetchAccounts(p)}
                style={{
                  height: 28, width: 28,
                  background: p === meta.page ? '#0A6E5F' : '#F7F8FA',
                  color: p === meta.page ? '#FFFFFF' : '#374151',
                  border: `1px solid ${p === meta.page ? '#085A4E' : '#D1D5E0'}`,
                  borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <CreateAccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />

      {/* Temp password toast */}
      {tempResult && (
        <TempPasswordToast result={tempResult} onDismiss={() => setTempResult(null)} />
      )}
    </>
  );
}
```

### 8.5 Admin Root Page

**File: `frontend/src/app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/admin/accounts');
}
```

---

## Part 9 — Frontend: Update Root Layout for IBM Plex Fonts

In `frontend/src/app/layout.tsx`, add IBM Plex Sans and IBM Plex Mono (required by design-standard.md Section 3):

```tsx
import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: "DAMAYAN EMR",
  description: "Problem-Oriented Dynamic Clinical Note Interface",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("h-full antialiased", ibmPlexSans.variable, ibmPlexMono.variable)}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
```

Also update `globals.css` — replace the `--font-mono` token to use IBM Plex Mono:

```css
@theme inline {
  --font-mono: var(--font-mono); /* now IBM Plex Mono via layout.tsx */
}
```

---

## Part 10 — Frontend: Environment Variables

**File: `frontend/.env.local`** (create from `.env.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## Part 11 — Verification Checklist

Work through this list in order after implementing all parts above.

### Backend

- [ ] `npm run start:dev` starts without errors
- [ ] Console shows `Prisma connected to Supabase`
- [ ] Console shows `Admin account seeded successfully` on first run, then `Seed skipped` on subsequent runs
- [ ] `GET /` returns `Hello World!` (no auth required)
- [ ] `GET /auth/me` without token → 401
- [ ] `POST /auth/change-password` without token → 401
- [ ] `GET /accounts` without token → 401
- [ ] `GET /accounts` with valid non-Admin JWT → 403
- [ ] `GET /accounts` with valid Admin JWT → 200 with paginated user list
- [ ] `POST /accounts` with valid Admin JWT and valid body → 201 with `user` + `tempPassword`
- [ ] `POST /accounts` with duplicate email → 409 Conflict
- [ ] `DELETE /accounts/:id` for the last Admin → 409 Conflict
- [ ] Swagger at `/api` documents all Auth and Accounts endpoints

### Supabase JWT Hook

- [ ] Log in with the seeded Admin account via `/login`
- [ ] Inspect the Supabase session token at jwt.io — verify `user_role: "ADMIN"` is present in the payload
- [ ] `GET /auth/me` with that token → returns Admin profile including `role: "ADMIN"`

### Frontend — Login

- [ ] `http://localhost:3000/login` renders the DAMAYAN login form
- [ ] Logging in with wrong credentials shows inline error message
- [ ] Logging in with Admin credentials redirects to `/admin/accounts`
- [ ] Visiting `/admin` while not logged in redirects to `/login`
- [ ] Visiting `/login` while logged in redirects to `/admin`

### Frontend — Admin Panel

- [ ] Accounts table renders with correct columns: Name, Email, Role, Status, Created, Actions
- [ ] Role badges render in correct colors (Admin = purple, Doctor = teal, Nurse = blue)
- [ ] Status badge: Active = green, Inactive = grey
- [ ] "+ New Account" opens the modal
- [ ] Modal validates: email format, first/last name length
- [ ] Submitting the modal creates the account and shows the temp password toast
- [ ] Temp password toast persists until dismissed (or 60 seconds)
- [ ] Deactivating a Doctor/Nurse account removes the "Deactivate" button and sets status to Inactive
- [ ] The Admin row has no "Deactivate" button visible
- [ ] Sign Out clears session and redirects to `/login`

---

## Part 12 — File Tree After Phase 3

```
backend/src/
  auth/
    strategies/
      jwt.strategy.ts           ← NEW
    guards/
      jwt-auth.guard.ts         ← NEW
      roles.guard.ts            ← NEW
    decorators/
      roles.decorator.ts        ← NEW
      current-user.decorator.ts ← NEW
    dto/
      create-user.dto.ts        (unchanged)
      change-password.dto.ts    ← NEW
    auth.controller.ts          ← UPDATED (fully implemented)
    auth.module.ts              ← UPDATED
    auth.service.ts             ← NEW

  accounts/
    dto/
      create-account.dto.ts     (unchanged)
      update-account.dto.ts     ← NEW
    accounts.controller.ts      ← UPDATED (fully implemented)
    accounts.module.ts          ← UPDATED
    accounts.service.ts         ← NEW

frontend/src/
  app/
    login/
      page.tsx                  ← NEW
    admin/
      layout.tsx                ← NEW
      page.tsx                  ← NEW (redirect)
      accounts/
        page.tsx                ← NEW
  lib/
    supabase/
      client.ts                 ← NEW
      server.ts                 ← NEW
    api.ts                      ← NEW
  stores/
    authStore.ts                ← NEW
  middleware.ts                 ← NEW
```

---

## Notes

**Temp password delivery:** The `POST /accounts` response returns `tempPassword` in the JSON body. The Admin must copy it from the modal and deliver it to the new user via a secure out-of-band channel (e.g., direct message). It is never stored in the database.

**Role injection:** The JWT hook adds `user_role` to the Supabase token. The `JwtStrategy.validate()` method then cross-checks against `public.users` to ensure the account is still active. This provides both performance (no role lookup needed per request for most endpoints) and correctness (revocation via `is_active = false` is still enforced).

**ADMIN cannot be created via `POST /accounts`:** The `AccountRole` enum in `create-account.dto.ts` intentionally excludes `ADMIN`. Admin accounts can only be created via the `seedAdminAccount()` hook using environment credentials.

**Phase 4 prerequisite:** All patient-facing screens depend on Phase 3 guards being in place. The stub modules (PatientsModule, VisitsModule, etc.) can have `JwtAuthGuard` and `RolesGuard` added to their controllers as Phase 4 work begins.