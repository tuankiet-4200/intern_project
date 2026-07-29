import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export type RefreshMetadata = {
  userAgent?: string;
  ipAddress?: string;
};

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto, metadata: RefreshMetadata = {}) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already registered');
    if (dto.role && dto.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('Vendor and admin roles must be provisioned through approved workflows');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const refreshToken = this.generateRefreshToken();
    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          role: dto.role ?? UserRole.CUSTOMER,
        },
        select: SAFE_USER_SELECT,
      });
      await this.createRefreshSession(tx, createdUser.id, refreshToken, metadata);
      return createdUser;
    });

    return {
      user,
      accessToken: await this.signAccessToken(user),
      refreshToken,
    };
  }

  async login(dto: LoginDto, metadata: RefreshMetadata = {}) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (user.status !== 'ACTIVE') throw new UnauthorizedException('Account is not active');

    const safeUser = { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status };
    const refreshToken = this.generateRefreshToken();
    await this.createRefreshSession(this.prisma, user.id, refreshToken, metadata);
    return {
      user: safeUser,
      accessToken: await this.signAccessToken(safeUser),
      refreshToken,
    };
  }

  async refresh(refreshToken: string | undefined, metadata: RefreshMetadata = {}) {
    if (!refreshToken) throw new UnauthorizedException('Refresh token is missing');

    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { select: SAFE_USER_SELECT } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const nextRefreshToken = this.generateRefreshToken();
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshSession.updateMany({
        where: { id: session.id, revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Refresh token was already used');
      await this.createRefreshSession(tx, session.userId, nextRefreshToken, metadata);
    });

    return {
      user: session.user,
      accessToken: await this.signAccessToken(session.user),
      refreshToken: nextRefreshToken,
    };
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    await this.prisma.refreshSession.updateMany({
      where: { tokenHash: this.hashRefreshToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logoutAll(userId: string) {
    await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private signAccessToken(user: { id: string; email: string; role: UserRole | string }) {
    return this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  private generateRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private refreshExpiry() {
    const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30);
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  private createRefreshSession(
    client: Prisma.TransactionClient | PrismaService,
    userId: string,
    refreshToken: string,
    metadata: RefreshMetadata,
  ) {
    return client.refreshSession.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: this.refreshExpiry(),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });
  }
}
