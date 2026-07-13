import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');
    if (dto.role === UserRole.ADMIN) throw new BadRequestException('Admin accounts must be provisioned internally');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role ?? UserRole.CUSTOMER,
      },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    return {
      user,
      accessToken: await this.signAccessToken(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const safeUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
    return {
      user: safeUser,
      accessToken: await this.signAccessToken(safeUser),
    };
  }

  private signAccessToken(user: { id: string; email: string; role: UserRole | string }) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
