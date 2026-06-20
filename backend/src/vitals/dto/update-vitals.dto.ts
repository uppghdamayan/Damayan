import { PartialType } from '@nestjs/swagger';
import { CreateVitalsDto } from './create-vitals.dto';

export class UpdateVitalsDto extends PartialType(CreateVitalsDto) {}
