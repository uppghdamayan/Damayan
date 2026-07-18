import {
  IsString,
  MinLength,
  MaxLength,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AccountRole } from './create-account.dto';

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Maria' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Santos' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(30)
  lastName?: string;

  @ApiPropertyOptional({ example: 'Cruz' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  middleName?: string;

  @ApiPropertyOptional({ enum: AccountRole })
  @IsOptional()
  @IsEnum(AccountRole)
  role?: AccountRole;

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
