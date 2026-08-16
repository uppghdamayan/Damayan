import { PartialType } from '@nestjs/swagger';
import { CreateProgressNoteDto } from './create-progress-note.dto';

export class UpdateProgressNoteDto extends PartialType(CreateProgressNoteDto) {}
