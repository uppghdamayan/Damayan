import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProblemDto {
  @ApiProperty({ example: 'Hypertension, Stage 2' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'I10' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  icdCode?: string;

  @ApiPropertyOptional({ example: '2023-01-01' })
  @IsOptional()
  @IsString()
  diagnosisDate?: string | null;

  @ApiPropertyOptional({
    description:
      'Root-level problem ID to nest this new problem under. Omit for a root-level problem.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
