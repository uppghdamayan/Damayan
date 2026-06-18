import { Module } from '@nestjs/common';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService], // required so Phase 8/9 modules can inject it later
})
export class ProblemsModule {}
