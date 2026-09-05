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
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AssessmentItemDto {
  // Stable Problem.id this snapshot entry represents, when it already exists
  // as a master Problem record. See progress-notes AssessmentItemDto for why
  // this matters — matching on title text alone causes duplicate problems
  // whenever a title is edited.
  @IsString()
  @IsOptional()
  id?: string;

  // Client-generated key for a problem added within this note that has no
  // master Problem row yet. See progress-notes AssessmentItemDto for details.
  @IsString()
  @IsOptional()
  tempId?: string;

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
  // than creating a new one. See progress-notes MedicationItemDto for the
  // full reasoning — kept in sync here, both note types share the mapper.
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
  // ['dose']) — mirrors progress-notes MedicationItemDto's `editedFields`.
  // Kept for parity between the two note types even though the initial
  // note has no equivalent to reconcileMedicationSnapshot's server-side
  // resync yet — an unlisted key here would be a 400 under the global
  // ValidationPipe's forbidNonWhitelisted, breaking the in-note dose-edit
  // pin the moment the frontend starts sending it.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  editedFields?: string[];
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
