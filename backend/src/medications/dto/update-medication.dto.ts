import { PartialType } from '@nestjs/swagger';
import { CreateMedicationDto } from './create-medication.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
