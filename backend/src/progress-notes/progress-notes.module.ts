import { Module } from '@nestjs/common';
import { ProgressNotesService } from './progress-notes.service';
import { ProgressNotesController } from './progress-notes.controller';
import { ProblemsModule } from '../problems/problems.module';
import { MedicationsModule } from '../medications/medications.module';
import { VitalsModule } from '../vitals/vitals.module';
import { VisitsModule } from '../visits/visits.module';
import { InitialNotesModule } from '../initial-notes/initial-notes.module';

@Module({
  imports: [
    ProblemsModule,
    MedicationsModule,
    VitalsModule,
    VisitsModule,
    InitialNotesModule,
  ],
  controllers: [ProgressNotesController],
  providers: [ProgressNotesService],
})
export class ProgressNotesModule {}
