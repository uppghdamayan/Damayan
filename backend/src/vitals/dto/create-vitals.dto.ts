import {
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateVitalsDto {
  @ApiPropertyOptional({ example: 120, description: 'Systolic BP, mmHg' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(300)
  sbp?: number;

  @ApiPropertyOptional({ example: 80, description: 'Diastolic BP, mmHg' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(200)
  dbp?: number;

  @ApiPropertyOptional({ example: 72, description: 'Heart rate, bpm' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(300)
  heartRate?: number;

  @ApiPropertyOptional({ example: 16, description: 'Respiratory rate, breaths/min' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(60)
  respiratoryRate?: number;

  @ApiPropertyOptional({ example: 36.8, description: 'Temperature, Celsius' })
  @IsOptional()
  @IsNumber()
  @Min(30.0)
  @Max(45.0)
  @Type(() => Number)
  temperature?: number;

  @ApiPropertyOptional({ example: 98, description: 'Oxygen saturation, SpO2 %' })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(100)
  oxygenSaturation?: number;

  @ApiProperty({ example: '2026-06-20T09:30:00.000Z' })
  @IsNotEmpty()
  @IsDateString()
  measuredAt: string;
}
