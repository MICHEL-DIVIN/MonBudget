import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

const trimLower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

/** Min. 8 caractères, au moins une lettre et un chiffre. */
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const PASSWORD_MSG = 'Le mot de passe doit contenir au moins 8 caractères dont une lettre et un chiffre';

export class RegisterDto {
  @Transform(trimLower)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;
}

export class LoginDto {
  @Transform(trimLower)
  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;
}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  refresh_token!: string;
}

export class GoogleDto {
  @IsString()
  @MinLength(20)
  id_token!: string;
}

export class ForgotPasswordDto {
  @Transform(trimLower)
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @Transform(trimLower)
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  new_password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  current_password!: string;

  @IsString()
  @MaxLength(128)
  @Matches(PASSWORD_RULE, { message: PASSWORD_MSG })
  new_password!: string;

  /** Refresh token de l'appareil courant : il reste valide, les autres sessions sont fermées. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  refresh_token?: string;
}
