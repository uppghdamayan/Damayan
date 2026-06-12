import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewSecure!Pass2024' })
  @IsString()
  @MinLength(12)
  newPassword: string;
}
