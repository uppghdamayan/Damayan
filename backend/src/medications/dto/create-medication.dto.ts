import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMedicationDto {
  @ApiProperty({ example: 'Losartan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({ example: '50 mg', description: 'Free text dose amount' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  dose: string;

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
