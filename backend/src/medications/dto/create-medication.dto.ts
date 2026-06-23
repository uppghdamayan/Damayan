import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsNumber,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedUnit } from '@prisma/client';

export class CreateMedicationDto {
  @ApiProperty({ example: 'Losartan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: 50, description: 'Numeric dose amount, > 0' })
  @IsNumber()
  @Min(0.01)
  @Max(99999.99)
  dose: number;

  @ApiProperty({ enum: MedUnit, example: MedUnit.MG })
  @IsEnum(MedUnit)
  unit: MedUnit;

  @ApiPropertyOptional({ example: 'Tablet' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  formulation?: string;

  @ApiPropertyOptional({ example: 'Once daily with food' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  instructions?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
