import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
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
import { SupabaseModule } from './supabase/supabase.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Makes process.env available everywhere without re-importing
    }),
    PrismaModule, // ← must be first after ConfigModule
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
    SupabaseModule,
    StorageModule,
  ],
})
export class AppModule {}
