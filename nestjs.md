# DAMAYAN Phase 1 — NestJS Backend Configuration
## CORS · ValidationPipe · Swagger

> **Agentic Instruction File**
> Follow every step in sequence. Do not skip steps. Do not modify package versions unless a conflict is explicitly encountered. All file paths are relative to the NestJS backend root.

---

## CONTEXT

- **Project:** DAMAYAN — Problem-Oriented EMR for Philippine Clinical Settings
- **Backend:** NestJS with TypeScript strict mode
- **Frontend:** Next.js 14+ (App Router), running on `http://localhost:3000`
- **Backend Port:** `3001`
- **Goal:** Configure CORS, global ValidationPipe, and Swagger on the NestJS entry point (`main.ts`); scaffold all backend modules including the new AccountsModule

---

## PREREQUISITES

Confirm these are true before proceeding:

- [ ] NestJS project is initialized with TypeScript strict mode
- [ ] `src/app.module.ts` exists
- [ ] `src/main.ts` exists (default scaffold is fine)
- [ ] `.env` file exists at backend root

---

## STEP 1 — Install Required Packages

Run the full install sequence from the document exactly as defined in section 4.2:

```bash
npm i -g @nestjs/cli
nest new damayan-backend
cd damayan-backend

npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @supabase/supabase-js @prisma/client prisma
npm install class-validator class-transformer
npm install @nestjs/swagger swagger-ui-express
npm install multer @types/multer
npm install --save-dev @types/passport-jwt
```

> If the NestJS project already exists, skip `nest new` and run only the `npm install` lines inside the project directory.

**What each package does:**

| Package | Purpose |
|---|---|
| `@nestjs/config` | Global ConfigModule for `process.env` access |
| `@nestjs/jwt` | JWT signing and verification |
| `@nestjs/passport` + `passport` + `passport-jwt` | Passport strategy integration for JWT auth |
| `@supabase/supabase-js` | Supabase client for Auth admin API and Storage |
| `@prisma/client` + `prisma` | ORM for Supabase PostgreSQL |
| `@nestjs/swagger` | Generates OpenAPI spec and Swagger UI |
| `swagger-ui-express` | Serves the Swagger UI at `/api` |
| `class-validator` | Decorator-based DTO validation (`@IsEmail`, `@IsString`, etc.) |
| `class-transformer` | Transforms plain objects into DTO class instances |
| `multer` + `@types/multer` | Multipart file upload handling |
| `@types/passport-jwt` | Type definitions for JWT Passport strategy |

---

## STEP 2 — Update `.env`

Open `.env` at the backend root. Set all variables exactly as defined in section 4.5 of the MVP document:

```env
# Server
PORT=3001
NODE_ENV=development

# CORS
FRONTEND_URL=http://localhost:3000

# Supabase
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.[ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=your-supabase-jwt-secret

# Admin seed account (used by AccountsModule onModuleInit to bootstrap first Admin)
ADMIN_EMAIL=admin@damayan.local
ADMIN_PASSWORD=your-secure-admin-password
```

> **Note:** Replace all placeholder values (`xxxx`, `[ref]`, `[password]`, `eyJ...`) with real credentials from your Supabase project. `ADMIN_EMAIL` and `ADMIN_PASSWORD` are used only once during first startup to seed the initial Admin account — they are never stored in the database.

---

## STEP 3 — Rewrite `src/main.ts`

**File path:** `src/main.ts`

**Action:** Replace the entire file content with the following:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─────────────────────────────────────────────
  // CORS
  // ─────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─────────────────────────────────────────────
  // GLOBAL VALIDATION PIPE
  // ─────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,              // Strip properties not declared in DTO
      forbidNonWhitelisted: true,   // Throw 400 if unknown properties are sent
      transform: true,              // Auto-transform payload to DTO class instance
      transformOptions: {
        enableImplicitConversion: true, // Convert query string types automatically
      },
    }),
  );

  // ─────────────────────────────────────────────
  // SWAGGER
  // ─────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('DAMAYAN EMR API')
    .setDescription('Problem-Oriented EMR System for Philippine Clinical Settings')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your Supabase JWT access token',
      },
      'access_token',
    )
    .addTag('Auth', 'User authentication and provisioning')
    .addTag('Accounts', 'Admin-only user account management')
    .addTag('Patients', 'Patient management')
    .addTag('Visits', 'Visit records')
    .addTag('Initial Notes', 'Initial consultation SOAP notes')
    .addTag('Progress Notes', 'Progress notes with copy-forward logic')
    .addTag('Problems', 'Problem list management')
    .addTag('Medications', 'Medication management')
    .addTag('Vitals', 'Vital signs recording and history')
    .addTag('Documents', 'Document generation and retrieval')
    .addTag('Attachments', 'File uploads and signed URL downloads')
    .addTag('Audit Logs', 'Complete audit trail')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // ─────────────────────────────────────────────
  // START SERVER
  // ─────────────────────────────────────────────
  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`✓ DAMAYAN API running   → http://localhost:${port}`);
  console.log(`✓ Swagger docs          → http://localhost:${port}/api`);
}

bootstrap();
```

> **Tag count:** 12 tags total — Auth, Accounts, Patients, Visits, Initial Notes, Progress Notes, Problems, Medications, Vitals, Documents, Attachments, Audit Logs. The `Accounts` tag is new in V4 for the Admin account management module.

---

## STEP 4 — Configure `src/app.module.ts`

**File path:** `src/app.module.ts`

Replace with the following. This registers `ConfigModule` globally and imports all backend modules as defined in section 5.2 of the MVP document:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { PatientsModule } from './patients/patients.module';
import { VisitsModule } from './visits/visits.module';
import { InitialNotesModule } from './initial-notes/initial-notes.module';
import { ProgressNotesModule } from './progress-notes/progress-notes.module';
import { ProblemsModule } from './problems/problems.module';
import { MedicationsModule } from './medications/medications.module';
import { VitalsModule } from './vitals/vitals.module';
import { DocumentsModule } from './documents/documents.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes process.env available everywhere without re-importing
    }),
    AuthModule,
    AccountsModule,
    PatientsModule,
    VisitsModule,
    InitialNotesModule,
    ProgressNotesModule,
    ProblemsModule,
    MedicationsModule,
    VitalsModule,
    DocumentsModule,
    AttachmentsModule,
    AuditLogsModule,
  ],
})
export class AppModule {}
```

> The module files don't need full implementation yet — empty scaffolds are sufficient for Phase 1. Implementation happens per-module in Phases 2–12.

---

## STEP 5 — Scaffold the Backend Folder Structure

Create the full folder structure exactly as defined in section 5.2 of the MVP document. Run from the backend root:

```bash
mkdir -p src/common/guards
mkdir -p src/common/decorators
mkdir -p src/common/interceptors
mkdir -p src/common/filters
mkdir -p src/common/pipes
mkdir -p src/prisma
mkdir -p src/auth/dto
mkdir -p src/accounts/dto
mkdir -p src/patients/dto
mkdir -p src/visits/dto
mkdir -p src/initial-notes/dto
mkdir -p src/progress-notes/dto
mkdir -p src/problems/dto
mkdir -p src/medications/dto
mkdir -p src/vitals/dto
mkdir -p src/documents/dto
mkdir -p src/attachments/dto
mkdir -p src/audit-logs/dto
```

The full expected structure:

```
src/
├── main.ts
├── app.module.ts
├── common/
│   ├── guards/         # JwtAuthGuard, RolesGuard (Phase 2)
│   ├── decorators/     # @Roles(), @CurrentUser() (Phase 2)
│   ├── interceptors/   # AuditLogInterceptor, TransformInterceptor (Phase 12)
│   ├── filters/        # HttpExceptionFilter
│   └── pipes/          # ZodValidationPipe
├── prisma/             # PrismaModule, PrismaService (Phase 3)
├── auth/               # AuthModule, AuthGuard, JwtStrategy (Phase 2)
├── accounts/           # AccountsModule — Admin CRUD for user accounts
├── patients/           # PatientsModule (Phase 4)
├── visits/             # VisitsModule (Phase 5)
├── initial-notes/      # InitialNotesModule (Phase 6)
├── progress-notes/     # ProgressNotesModule (Phase 7)
├── problems/           # ProblemsModule (Phase 8)
├── medications/        # MedicationsModule (Phase 9)
├── vitals/             # VitalsModule (Phase 10)
├── documents/          # DocumentsModule — PDF generation (Phase 11)
├── attachments/        # AttachmentsModule — Supabase Storage (Phase 11)
└── audit-logs/         # AuditLogsModule (Phase 12)
```

---

## STEP 6 — Create Empty Module Scaffolds

Create a minimal scaffold for each module so `app.module.ts` imports resolve without errors. Repeat this pattern for every module listed below.

**Pattern** (example for `patients`):

```typescript
// src/patients/patients.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class PatientsModule {}
```

Create the following files using this pattern:

| File | Export class name |
|---|---|
| `src/auth/auth.module.ts` | `AuthModule` |
| `src/accounts/accounts.module.ts` | `AccountsModule` |
| `src/patients/patients.module.ts` | `PatientsModule` |
| `src/visits/visits.module.ts` | `VisitsModule` |
| `src/initial-notes/initial-notes.module.ts` | `InitialNotesModule` |
| `src/progress-notes/progress-notes.module.ts` | `ProgressNotesModule` |
| `src/problems/problems.module.ts` | `ProblemsModule` |
| `src/medications/medications.module.ts` | `MedicationsModule` |
| `src/vitals/vitals.module.ts` | `VitalsModule` |
| `src/documents/documents.module.ts` | `DocumentsModule` |
| `src/attachments/attachments.module.ts` | `AttachmentsModule` |
| `src/audit-logs/audit-logs.module.ts` | `AuditLogsModule` |

---

## STEP 7 — Create the Auth DTO and Controller (Verify Swagger + ValidationPipe)

### 7a. Create `src/auth/dto/create-user.dto.ts`

This DTO is used for verifying ValidationPipe is working. It maps to the `CreateUserDto` defined in section 12.1 of the MVP document:

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum UserRole {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  ADMIN = 'ADMIN',
}

export class CreateUserDto {
  @ApiProperty({ example: 'juan.dela.cruz@damayan.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  lastName: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Jr.' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  extension?: string;

  @ApiProperty({ enum: UserRole, example: UserRole.DOCTOR })
  @IsEnum(UserRole)
  role: UserRole;
}
```

### 7b. Create `src/auth/auth.controller.ts`

Scaffold controller matching the Auth endpoints defined in section 12.1. Implementation is deferred to Phase 2 — stubs only:

```typescript
import {
  Controller,
  Post,
  Patch,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Get current user profile from JWT' })
  async getMe() {
    // Phase 2: extract from @CurrentUser() decorator
    return { message: 'stub — implement in Phase 2' };
  }

  @Post('users')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Provision a new user (Admin only)',
    description:
      'Creates a new user via Supabase service_role key. ' +
      'Self-registration is disabled. All accounts must be created through this endpoint.',
  })
  @ApiCreatedResponse({ description: 'User provisioned successfully.' })
  async createUser(@Body() dto: CreateUserDto) {
    // Phase 2: implement AuthService.provisionUser()
    return { message: 'stub — implement in Phase 2', data: dto };
  }

  @Patch('users/:id')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Update role or deactivate account (Admin only)' })
  async updateUser(@Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    // Phase 2: implement AuthService.deactivateUser()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Post('change-password')
  @ApiBearerAuth('access_token')
  @ApiOperation({ summary: 'Change password (authenticated user)' })
  async changePassword(@Body() dto: any) {
    // Phase 2: implement ChangePasswordDto + AuthService
    return { message: 'stub — implement in Phase 2' };
  }
}
```

### 7c. Update `src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
})
export class AuthModule {}
```

---

## STEP 8 — Create the Accounts Module Scaffold

The `AccountsModule` is new in V4. It handles Admin-only user account management (GET, POST, PATCH, DELETE /accounts) and seeds the initial Admin account on startup. Per section 12.10 of the MVP document:

### 8a. Create `src/accounts/dto/create-account.dto.ts`

```typescript
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccountRole {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  // ADMIN is intentionally excluded — cannot be created via this endpoint
}

export class CreateAccountDto {
  @ApiProperty({ example: 'juan.dela.cruz@damayan.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  lastName: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiProperty({ enum: AccountRole, example: AccountRole.DOCTOR })
  @IsEnum(AccountRole)
  role: AccountRole;
}
```

### 8b. Create `src/accounts/accounts.controller.ts`

Stub controller matching all endpoints in section 12.10:

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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CreateAccountDto } from './dto/create-account.dto';

@ApiTags('Accounts')
@ApiBearerAuth('access_token')
@Controller('accounts')
export class AccountsController {
  @Get()
  @ApiOperation({ summary: 'List all user accounts (Admin only)' })
  @ApiOkResponse({ description: 'Paginated list of accounts.' })
  async findAll(
    @Query('role') role?: string,
    @Query('is_active') isActive?: boolean,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    // Phase 2: implement AccountsService.findAll()
    return { message: 'stub — implement in Phase 2' };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create user account (Admin only)',
    description:
      'Provisions a new Doctor or Nurse account. ' +
      'Generates a cryptographically random temporary password (16 chars). ' +
      'Returns temp password once — never stored.',
  })
  @ApiCreatedResponse({ description: 'Account created; temp password returned once.' })
  async create(@Body() dto: CreateAccountDto) {
    // Phase 2: implement AccountsService.create()
    return { message: 'stub — implement in Phase 2', data: dto };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single account profile (Admin only)' })
  async findOne(@Param('id') id: string) {
    // Phase 2: implement AccountsService.findOne()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update account name or role (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: Partial<CreateAccountDto>) {
    // Phase 2: implement AccountsService.update()
    return { message: 'stub — implement in Phase 2', id };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate account (Admin only)',
    description:
      'Soft-deactivates the account: sets is_active = false in users table ' +
      'and disables login in Supabase Auth. Audit trail is preserved.',
  })
  async deactivate(@Param('id') id: string) {
    // Phase 2: implement AccountsService.deactivate()
    return { message: 'stub — implement in Phase 2', id };
  }
}
```

### 8c. Create `src/accounts/accounts.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';

@Module({
  controllers: [AccountsController],
})
export class AccountsModule {}
```

> **Admin seed note:** The `AccountsService.seedAdminAccount()` method (called via `onModuleInit`) will be implemented in Phase 2. It reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `ConfigService`, checks if any ADMIN user exists, and creates one if not. The seed is idempotent — it runs safely on every startup.

---

## STEP 9 — Run and Verify

Start the dev server:

```bash
npm run start:dev
```

**Expected terminal output:**
```
✓ DAMAYAN API running   → http://localhost:3001
✓ Swagger docs          → http://localhost:3001/api
```

**Verify each configuration:**

### CORS
Send a test request from the frontend origin (`http://localhost:3000`) to `http://localhost:3001/auth/users`. No CORS error should appear. Requests from any other origin should be blocked.

### ValidationPipe
Send a POST to `http://localhost:3001/auth/users` with an invalid payload:

```json
{
  "email": "not-an-email",
  "firstName": "J",
  "role": "SUPERUSER"
}
```

Expected response: `400 Bad Request` with an array of validation error messages.

Send a valid payload:

```json
{
  "email": "juan@damayan.ph",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "role": "DOCTOR"
}
```

Expected response: `201 Created`.

### Swagger UI
Open `http://localhost:3001/api` in the browser.

Expected:
- Page title: **DAMAYAN EMR API**
- All **12 tags** visible: Auth, **Accounts**, Patients, Visits, Initial Notes, Progress Notes, Problems, Medications, Vitals, Documents, Attachments, Audit Logs
- Endpoints visible under **Auth** tag: `GET /auth/me`, `POST /auth/users`, `PATCH /auth/users/:id`, `POST /auth/change-password`
- Endpoints visible under **Accounts** tag: `GET /accounts`, `POST /accounts`, `GET /accounts/:id`, `PATCH /accounts/:id`, `DELETE /accounts/:id`
- **Authorize** button present (Bearer JWT)

---

## STEP 10 — Production Checklist (Before Deployment to Render/Railway)

Before deploying, update `.env` for production:

```env
NODE_ENV=production
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

Swagger is acceptable to keep enabled for DAMAYAN MVP since it is an internal tool. To disable in production, add this guard in `main.ts` around the Swagger setup block:

```typescript
if (process.env.NODE_ENV !== 'production') {
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}
```

---

## COMPLETION CHECKLIST

- [ ] All packages installed per section 4.2 of MVP document
- [ ] `.env` has all 9 required variables including `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- [ ] `src/main.ts` rewritten with CORS, ValidationPipe, and Swagger (12 tags)
- [ ] `ConfigModule` registered globally in `app.module.ts`
- [ ] All 12 module folders created with empty scaffolds
- [ ] `app.module.ts` imports all 12 modules without errors
- [ ] `src/auth/dto/create-user.dto.ts` created
- [ ] `src/auth/auth.controller.ts` created with 4 stub endpoints
- [ ] `src/accounts/dto/create-account.dto.ts` created (DOCTOR | NURSE only — no ADMIN)
- [ ] `src/accounts/accounts.controller.ts` created with 5 stub endpoints
- [ ] `src/accounts/accounts.module.ts` created
- [ ] Dev server starts without TypeScript or import errors
- [ ] Swagger UI loads at `http://localhost:3001/api` with 12 tags
- [ ] Invalid payload returns `400` with validation messages
- [ ] Valid payload returns `201`

---

## NEXT STEP

Proceed to **Phase 2: Authentication & RBAC**

→ Implement `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `@Roles()` decorator, `@CurrentUser()` decorator, login page, forced password reset, and `AccountsService.seedAdminAccount()` using `onModuleInit`.