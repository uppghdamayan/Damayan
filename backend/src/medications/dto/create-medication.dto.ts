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

  @ApiProperty({ example: 'Tablet' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  formulation: string;

  @ApiProperty({ example: 'Once daily with food' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  instructions: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  quantity: number;
}
