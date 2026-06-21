import { IsString, IsOptional, IsArray, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateProgressNoteDto {
  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  mgmtNonpharm?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  diagnostics?: string[];

  @IsDateString()
  @IsNotEmpty()
  visitDatetime: string;
}
