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
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssessmentItemDto {
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

  @IsBoolean()
  @IsOptional()
  isNew?: boolean;

  @ValidateIf((o) => o.diagnosisDate !== null)
  @IsDateString()
  @IsOptional()
  diagnosisDate?: string | null;
}

export class MedicationItemDto {
  // No stable identity field here (unlike AssessmentItemDto): matching at
  // publish time (MedicationsService#upsertFromNoteMedications /
  // resolveMedicationMatches) is by (name, dose), including a same-name
  // dose change, which updates the existing Medication row IN PLACE rather
  // than creating a new one. An id is nevertheless unnecessary — every
  // already-persisted medicationSnapshot predates any such field, and
  // MedicationsService#remove is a hard delete, so a stored id could point
  // at a nonexistent row. Name+dose matching stays the source of truth;
  // adding an id would only be additive hardening for the rare case of two
  // active rows sharing a name that BOTH change dose in the same save
  // (ambiguous — falls back to discontinue+create, see
  // resolveMedicationMatches).
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  dose?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  formulation?: string;

  @Type(() => Number)
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  instructions?: string;

  @IsString()
  @IsOptional()
  @IsIn(['past', 'prescribed'])
  source?: 'past' | 'prescribed';

  @IsBoolean()
  @IsOptional()
  isNew?: boolean;

  @IsOptional()
  fromPast?: boolean;

  // Field names the clinician explicitly edited within this note (e.g.
  // ['dose']) — lets both the frontend merge (mergeActiveMedications) and
  // the server-side ProgressNotesService#reconcileMedicationSnapshot know a
  // later, unrelated master-list edit must not silently overwrite it.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  editedFields?: string[];
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
