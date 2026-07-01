import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NoteType } from '@prisma/client';

export class CreateAttachmentDto {
  @IsUUID()
  patientId: string;

  @IsEnum(NoteType)
  noteType: NoteType;

  @IsUUID()
  noteId: string;

  @IsString()
  @MaxLength(100)
  tag: string;

  @IsOptional()
  @IsString()
  textResult?: string;
}
