import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DocumentType } from '@prisma/client';

export class GenerateDocumentDto {
  @IsEnum(DocumentType)
  type: DocumentType;

  @IsOptional()
  @IsUUID()
  visitId?: string;

  @IsOptional()
  @IsUUID()
  physicianId?: string;

  // Medical Certificate
  @ValidateIf((o) => o.type === DocumentType.MEDICAL_CERTIFICATE)
  @IsString()
  @MaxLength(300)
  chiefComplaint?: string;

  @ValidateIf((o) => o.type === DocumentType.MEDICAL_CERTIFICATE)
  @IsString()
  @MaxLength(1000)
  recommendation?: string;

  // Referral Letter
  @ValidateIf((o) => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(150)
  referralRecipient?: string;

  @ValidateIf((o) => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(500)
  salientPoints?: string;

  @ValidateIf((o) => o.type === DocumentType.REFERRAL_LETTER)
  @IsString()
  @MaxLength(500)
  referralReason?: string;
}
