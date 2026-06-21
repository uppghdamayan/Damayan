import { Module } from '@nestjs/common';
import { InitialNotesService } from './initial-notes.service';
import { InitialNotesController } from './initial-notes.controller';
import { ProblemsModule } from '../problems/problems.module';
import { MedicationsModule } from '../medications/medications.module';
import { VitalsModule } from '../vitals/vitals.module';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [ProblemsModule, MedicationsModule, VitalsModule, VisitsModule],
  controllers: [InitialNotesController],
  providers: [InitialNotesService],
  exports: [InitialNotesService],
})
export class InitialNotesModule {}
