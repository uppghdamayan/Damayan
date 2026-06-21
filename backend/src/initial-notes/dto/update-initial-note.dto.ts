import { PartialType } from '@nestjs/swagger';
import { CreateInitialNoteDto } from './create-initial-note.dto';

export class UpdateInitialNoteDto extends PartialType(CreateInitialNoteDto) {}
