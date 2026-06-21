import { IsString, IsOptional, IsArray, MaxLength, ValidateNested, IsNotEmpty, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class AssessmentItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  icdCode?: string;
}

export class CreateInitialNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  chiefComplaint: string;

  @IsString()
  @IsNotEmpty()
  hpi: string;

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
  @IsNotEmpty()
  physicalExam: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentItemDto)
  assessment: AssessmentItemDto[];

  @IsString()
  @IsOptional()
  mgmtNonpharm?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnostics?: string[];

  @IsDateString()
  visitDatetime: string;
}
