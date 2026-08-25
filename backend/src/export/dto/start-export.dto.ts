import {
  IsString,
  IsArray,
  IsNotEmpty,
  ArrayMinSize,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExportObjectDto {
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsNotEmpty() hanaTableName: string;
  @IsString() @IsNotEmpty() csvFileName: string;
  @IsOptional() @IsNumber() @Min(0) rowCount?: number;
}

export class StartExportDto {
  @IsString() @IsNotEmpty() connectionId: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ExportObjectDto)
  objects: ExportObjectDto[];
}
