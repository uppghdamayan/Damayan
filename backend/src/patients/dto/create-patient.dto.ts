import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Sex } from '@prisma/client';

export class CreatePatientDto {
  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  lastName: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  firstName: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiPropertyOptional({ example: 'Jr.' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  extension?: string;

  @ApiProperty({ example: '1985-03-14' })
  @IsDateString()
  dateOfBirth: string;

  @ApiProperty({ enum: Sex })
  @IsEnum(Sex)
  sex: Sex;

  @ApiProperty({ example: '123 Taft Ave' })
  @IsString()
  @IsNotEmpty()
  addressStreet: string;

  @ApiProperty({ example: 'Barangay 660' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  addressBarangay: string;

  @ApiProperty({ example: 'Ermita, Manila' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  addressCity: string;

  @ApiProperty({ example: 'NCR (National Capital Region)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  addressRegion: string;
}
