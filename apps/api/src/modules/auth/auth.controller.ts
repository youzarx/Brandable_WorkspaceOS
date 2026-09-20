import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { ApiConfigService } from '../../config/api-config.service.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { InProcessRateLimiterService } from '../../common/rate-limit/in-process-rate-limiter.service.js';
import { getRefreshCookieOptions } from '@platform/auth';
import { AUTH_CONFIG } from '@platform/config';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  type LoginInput,
  type RegisterInput,
  type ChangePasswordInput,
} from '@platform/validation';
import type { AuthenticatedUser } from '@platform/types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly apiConfig: ApiConfigService,
    private readonly rateLimiter: InProcessRateLimiterService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.rateLimiter.checkRateLimit(`register:${req.ip}`);
    const validatedInput = registerSchema.parse(body);

    const { accessToken, rawRefreshToken, user } = await this.authService.register(validatedInput);

    this.setRefreshTokenCookie(res, rawRefreshToken);

    return { accessToken, user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.rateLimiter.checkRateLimit(`login:${req.ip}`);
    const validatedInput = loginSchema.parse(body);

    const { accessToken, rawRefreshToken, user } = await this.authService.login(validatedInput);

    this.setRefreshTokenCookie(res, rawRefreshToken);

    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    this.rateLimiter.checkRateLimit(`refresh:${req.ip}`);

    const rawRefreshToken = req.cookies?.[AUTH_CONFIG.COOKIE_NAME] || req.body?.refreshToken;

    const {
      accessToken,
      rawRefreshToken: newRawToken,
      user,
    } = await this.authService.refresh(rawRefreshToken);

    this.setRefreshTokenCookie(res, newRawToken);

    return { accessToken, user };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[AUTH_CONFIG.COOKIE_NAME] || req.body?.refreshToken;

    await this.authService.logout(rawRefreshToken);

    res.clearCookie(AUTH_CONFIG.COOKIE_NAME, {
      path: AUTH_CONFIG.COOKIE_PATH,
    });

    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: ChangePasswordInput,
    @Req() _req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.rateLimiter.checkRateLimit(`change-pass:${user.id}`);
    const validatedInput = changePasswordSchema.parse(body);

    await this.authService.changePassword(user.id, validatedInput);

    // Clear refresh cookie on password change (all sessions revoked)
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME, {
      path: AUTH_CONFIG.COOKIE_PATH,
    });

    return { message: 'Password changed successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  private setRefreshTokenCookie(res: Response, rawToken: string): void {
    const optionsInput: { nodeEnv: string; sameSite?: 'Strict' | 'Lax' | 'None'; domain?: string } = {
      nodeEnv: this.apiConfig.nodeEnv,
      sameSite: this.apiConfig.cookieSameSite,
    };
    if (this.apiConfig.cookieDomain) {
      optionsInput.domain = this.apiConfig.cookieDomain;
    }

    const cookieOptions = getRefreshCookieOptions(optionsInput);

    res.cookie(AUTH_CONFIG.COOKIE_NAME, rawToken, cookieOptions);
  }
}
