import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ValidateNested,
  IsNotEmpty,
  IsDateString,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class AssessmentItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // Nesting metadata carried by the problem list UI. Whitelisted so the
  // indentation of an assessment survives a round-trip — the global
  // ValidationPipe runs forbidNonWhitelisted, so an unlisted key is a 400.
  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsInt()
  @IsOptional()
  depth?: number;
}

class MedicationItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  dose?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  formulation?: string;

  @Type(() => Number)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsString()
  @IsOptional()
  @IsIn(['past', 'prescribed'])
  source?: 'past' | 'prescribed';
}

export class CreateInitialNoteDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  chiefComplaint?: string;

  @IsString()
  @IsOptional()
  hpi?: string;

  @IsString()
  @IsOptional()
  pmhComorbidities?: string;

  @IsString()
  @IsOptional()
  pmhSurgeries?: string;

  @IsString()
  @IsOptional()
  pmhHospitalizations?: string;

  @IsString()
  @IsOptional()
  allergies?: string;

  @IsString()
  @IsOptional()
  familyHistory?: string;

  @IsString()
  @IsOptional()
  socialHistory?: string;

  @IsString()
  @IsOptional()
  obHistory?: string;

  @IsString()
  @IsOptional()
  psychosocialHistory?: string;

  @IsString()
  @IsOptional()
  physicalExam?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentItemDto)
  @IsOptional()
  assessment?: AssessmentItemDto[];

  @IsString()
  @IsOptional()
  mgmtNonpharm?: string;

  @IsString()
  @IsOptional()
  mgmtPharm?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnostics?: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationItemDto)
  @IsOptional()
  medicationSnapshot?: MedicationItemDto[];

  @IsDateString()
  visitDatetime: string;
}
