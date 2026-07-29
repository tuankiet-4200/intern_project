import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;
}

export class CreateAddressDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipient!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  line1!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ward!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  recipient?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  line1?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ward?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
