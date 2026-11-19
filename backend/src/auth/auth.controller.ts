import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, type AuthUser } from '../common/auth.js';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  GoogleDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';

// Limites strictes contre le bourrage d'identifiants / le brute-force.
const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(STRICT)
  @Post('register')
  register(@Body() dto: RegisterDto, @Headers('user-agent') ua?: string) {
    return this.auth.register(dto.email, dto.password, dto.full_name, ua);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto, @Headers('user-agent') ua?: string) {
    return this.auth.login(dto.email, dto.password, ua);
  }

  @Public()
  @Throttle(STRICT)
  @HttpCode(200)
  @Post('google')
  google(@Body() dto: GoogleDto, @Headers('user-agent') ua?: string) {
    return this.auth.loginWithGoogle(dto.id_token, ua);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto, @Headers('user-agent') ua?: string) {
    return this.auth.refresh(dto.refresh_token, ua);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refresh_token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(200)
  @Post('forgot-password')
  async forgot(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('reset-password')
  async reset(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.email, dto.code, dto.new_password);
    return { ok: true };
  }

  @HttpCode(200)
  @Post('change-password')
  async change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    await this.auth.changePassword(user.id, dto.current_password, dto.new_password, dto.refresh_token);
    return { ok: true };
  }
}
