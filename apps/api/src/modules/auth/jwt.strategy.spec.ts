import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus, UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account-state validation', () => {
  const config = { get: () => 'test-secret' } as unknown as ConfigService;

  it('uses current database role for an active account', async () => {
    const findUnique = jest.fn(() => Promise.resolve({
      id: 'user-1', email: 'vendor@example.com', role: UserRole.VENDOR, status: AccountStatus.ACTIVE,
    }));
    const strategy = new JwtStrategy(config, { user: { findUnique } } as unknown as PrismaService);

    await expect(strategy.validate({ sub: 'user-1', email: 'old@example.com', role: UserRole.CUSTOMER }))
      .resolves.toEqual({ sub: 'user-1', email: 'vendor@example.com', role: UserRole.VENDOR });
  });

  it('rejects a banned account even while its access token is not expired', async () => {
    const findUnique = jest.fn(() => Promise.resolve({
      id: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER, status: AccountStatus.BANNED,
    }));
    const strategy = new JwtStrategy(config, { user: { findUnique } } as unknown as PrismaService);

    await expect(strategy.validate({ sub: 'user-1', email: 'user@example.com', role: UserRole.CUSTOMER }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
