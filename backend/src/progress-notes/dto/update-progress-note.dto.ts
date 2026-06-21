import { PartialType } from '@nestjs/swagger';
import { CreateProgressNoteDto } from './create-progress-note.dto';
import { IsOptional, IsArray } from 'class-validator';

export class UpdateProgressNoteDto extends PartialType(CreateProgressNoteDto) {
  @IsArray()
  @IsOptional()
  problemListSnapshot?: any[];

  @IsArray()
  @IsOptional()
  medicationSnapshot?: any[];
}
