import { IsEnum, IsDateString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitType } from '@prisma/client';

export class CreateVisitDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ example: '2026-06-12T09:00:00.000Z' })
  @IsDateString()
  visitDatetime: string;

  @ApiProperty({ enum: VisitType })
  @IsEnum(VisitType)
  visitType: VisitType;
}
