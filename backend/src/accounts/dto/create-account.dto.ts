import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AccountRole {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  // ADMIN is intentionally excluded — cannot be created via this endpoint
}

export class CreateAccountDto {
  @ApiProperty({ example: 'juan.dela.cruz@damayan.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  firstName: string;

  @ApiProperty({ example: 'Dela Cruz' })
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  lastName: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiProperty({ enum: AccountRole, example: AccountRole.DOCTOR })
  @IsEnum(AccountRole)
  role: AccountRole;

  @ApiPropertyOptional({ example: '1234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: 'PTR-1234' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  ptrNumber?: string;

  @ApiPropertyOptional({ example: 'S2-1234' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  s2Number?: string;
}
