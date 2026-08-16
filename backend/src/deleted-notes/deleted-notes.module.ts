import { Module } from '@nestjs/common';
import { DeletedNotesService } from './deleted-notes.service';
import { DeletedNotesController } from './deleted-notes.controller';

@Module({
  controllers: [DeletedNotesController],
  providers: [DeletedNotesService],
})
export class DeletedNotesModule {}
