import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateUser } from './dto/create-user.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { JwtPayload } from './types/payload.type';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
    ) { }

    async validateUser(email: string, password: string): Promise<User> {
        const user = await this.prismaService.user.findUnique({ where: { email } });
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new BadRequestException('Password does not match');
        }

        return user;
    }

    async login(user: User): Promise<{ access_token: string; refresh_token: string }> {
        const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

        const access_token = await this.jwtService.signAsync(payload, {
            secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
            expiresIn: this.configService.get<string>('ACCESS_TOKEN_TTL'),
        });

        const refresh_token = await this.jwtService.signAsync(payload, {
            secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.get<string>('REFRESH_TOKEN_TTL'),
        });

        const ttlSec = 7 * 24 * 60 * 60; // 7 днів
        const refreshTokenExpire = new Date(Date.now() + ttlSec * 1000);

        await this.prismaService.user.update({
            where: { id: user.id },
            data: {
                refreshToken: refresh_token,
                refreshTokenExpiry: refreshTokenExpire,
            },
        });


        return { access_token, refresh_token };
    }


    async register(userDto: CreateUser): Promise<{ access_token: string }> {
        const existingUser = await this.prismaService.user.findUnique({ where: { email: userDto.email } });
        if (existingUser) {
            throw new BadRequestException('Email already exists');
        }

        const hashedPassword = await bcrypt.hash(userDto.password, 10);

        const newUser = await this.prismaService.user.create({
            data: {
                email: userDto.email,
                username: userDto.username,
                password: hashedPassword,
            },
        });

        return this.login(newUser);
    }

    async logout(userId: string): Promise<boolean> {
        await this.prismaService.user.update({
            where: { id: userId },
            data: { refreshToken: null }
        })
        return true
    }

    async refreshToken(refresh_token: string) {
        const payload: JwtPayload = await this.jwtService.verify(refresh_token, { secret: this.configService.get('JWT_REFRESH_SECRET') });
        const user = await this.prismaService.user.findUnique({ where: { id: payload.sub } })
        if (!user?.refreshTokenExpiry || user.refreshTokenExpiry < new Date()) {
            throw new UnauthorizedException('Refresh token expired');
        }

        if (user?.refreshToken === refresh_token) return this.login(user)
    }


}
