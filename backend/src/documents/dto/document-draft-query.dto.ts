import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DocumentType } from '@prisma/client';

export class DocumentDraftQueryDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  visitId?: string;
}
