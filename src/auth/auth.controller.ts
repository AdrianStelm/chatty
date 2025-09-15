import { Controller, Post, Body, Request, UseGuards, Get, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUser } from './dto/create-user.dto';
import { Public } from './public.decorator';
import type { User as PrismaUser } from '@prisma/client';
import { CurrentUser } from './user.decorator';
import { User } from 'src/user/dto/user.dto';
import { UnauthorizedException } from '@nestjs/common';
import { LocalAuthGuard } from './local-auth.gurad';
import { JwtGuard } from './jwt.guard';
import type { JwtPayload } from './types/payload.type';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Public()
  @Post('register')
  async register(@Body() userDto: CreateUser) {
    return this.authService.register(userDto);
  }

  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  async login(@Request() req, @Res({ passthrough: true }) res: Response) {
    const user: PrismaUser = req.user;
    const { access_token, refresh_token } = await this.authService.login(user);

    res.cookie('refresh_token', refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    });

    return { access_token };
  }

  @Post('refresh')
  @Public()
  async refreshToken(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new UnauthorizedException('No refresh token');

    const tokens = await this.authService.refreshToken(refreshToken);

    if (!tokens) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
    });

    return { access_token: tokens.access_token };
  }

  @UseGuards(JwtGuard)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: JwtPayload) {
    console.log(user)
    await this.authService.logout(user.sub);
    res.clearCookie('refresh_token');
    return { message: 'Logged out successfully' };
  }


  @Get('profile')
  async profile(@Request() req, @CurrentUser() user: User): Promise<User> {
    return user
  }
}
