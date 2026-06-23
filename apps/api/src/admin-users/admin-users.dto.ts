import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const STAFF_ROLE_VALUES = ['super_admin', 'administrator', 'clinician', 'editor'] as const;
export const SCOPE_TYPE_VALUES = ['department', 'clinic', 'physician', 'facility'] as const;

export class ScopeDto {
  @IsIn(SCOPE_TYPE_VALUES as unknown as string[])
  scope_type!: string;

  @IsString()
  @MaxLength(64)
  scope_target_id!: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn(STAFF_ROLE_VALUES as unknown as string[])
  role!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ScopeDto)
  scopes?: ScopeDto[];
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsIn(STAFF_ROLE_VALUES as unknown as string[])
  role?: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ScopeDto)
  scopes?: ScopeDto[];
}

export class SetScopesDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ScopeDto)
  scopes!: ScopeDto[];
}
