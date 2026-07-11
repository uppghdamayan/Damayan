import {
  IsString,
  IsOptional,
  MaxLength,
  IsUUID,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProblemStatus } from '@prisma/client';

export class UpdateProblemDto {
  @ApiPropertyOptional({ example: 'Hypertension, Stage 2 — controlled' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ example: 'I10' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icdCode?: string | null;

  @ApiPropertyOptional({ example: '2023-01-01' })
  @IsOptional()
  @IsString()
  diagnosisDate?: string | null;

  @ApiPropertyOptional({ enum: ProblemStatus })
  @IsOptional()
  @IsEnum(ProblemStatus)
  status?: ProblemStatus;

  @ApiPropertyOptional({
    description:
      'Root-level problem ID to nest under. Pass null to un-nest (move to root level). Omit entirely to leave unchanged.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o) => o.parentId !== null)
  @IsUUID()
  parentId?: string | null;
}
