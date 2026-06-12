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
