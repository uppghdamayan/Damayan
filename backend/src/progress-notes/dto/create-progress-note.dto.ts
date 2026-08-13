import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsNotEmpty,
  ValidateNested,
  IsInt,
  IsIn,
  ValidateIf,
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

  // Client-generated key for a problem added within this note that has no
  // master Problem row yet — lets another freshly-added item nest under it
  // (as parentId) before either one has a real id. Never written to the DB;
  // resolved to a real Problem.id server-side during upsertFromAssessment.
  @IsString()
  @IsOptional()
  tempId?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  parentId?: string | null;

  @IsInt()
  @IsOptional()
  depth?: number;

  @ValidateIf((o) => o.diagnosisDate !== null)
  @IsDateString()
  @IsOptional()
  diagnosisDate?: string | null;
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

  // Optional: progress notes have no user-facing visit-date input, unlike
  // the initial note. The server stamps `now()` when this is omitted or
  // unparsable (see ProgressNotesService.create) rather than trusting a
  // client-supplied form-mount timestamp as the ordering key.
  @IsDateString()
  @IsOptional()
  visitDatetime?: string;

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
