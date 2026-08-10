import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

class AssessmentItemDto {
  // Stable Problem.id this snapshot entry represents, when it already exists
  // as a master Problem record. Required for upsertFromAssessment to match by
  // identity instead of by title text — without it, a title edited elsewhere
  // (or in-note) is indistinguishable from a brand-new problem and gets
  // duplicated instead of updated. Absent only for items freshly added within
  // this note that don't have a master Problem row yet.
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

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

  @IsOptional()
  fromPast?: boolean;
}

export class CreateProgressNoteDto {
  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  labs?: string;

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

  @IsDateString()
  @IsNotEmpty()
  visitDatetime: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssessmentItemDto)
  @IsOptional()
  problemListSnapshot?: AssessmentItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicationItemDto)
  @IsOptional()
  medicationSnapshot?: MedicationItemDto[];
}
