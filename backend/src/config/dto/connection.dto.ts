import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConnectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsString()
  @IsNotEmpty()
  schema: string;

  @IsString()
  @IsNotEmpty()
  user: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  @IsBoolean()
  encrypt?: boolean;

  @IsOptional()
  @IsBoolean()
  sslValidateCertificate?: boolean;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  host?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  schema?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  user?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  encrypt?: boolean;

  @IsOptional()
  @IsBoolean()
  sslValidateCertificate?: boolean;
}
