import { Module } from '@nestjs/common';
import { MedicationsController } from './medications.controller';
import { MedicationsService } from './medications.service';

@Module({
  controllers: [MedicationsController],
  providers: [MedicationsService],
  exports: [MedicationsService], // required so Phase 8/9 modules can inject it later
})
export class MedicationsModule {}
