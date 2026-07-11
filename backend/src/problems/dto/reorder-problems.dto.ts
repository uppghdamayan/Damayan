import {
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  id: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  sortOrder: number;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  icdCode?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  diagnosisDate?: string | null;
}

export class ReorderProblemsDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
