import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { describe, expect, it, jest } from '@jest/globals';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('rejects public admin registration', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<null>>().mockResolvedValue(null),
      },
    };
    const service = new AuthService(prisma as never, {} as never);

    await expect(
      service.register({
        email: 'admin@example.com',
        password: 'password123',
        fullName: 'Admin',
        role: UserRole.ADMIN,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate email registration', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'existing' }),
      },
    };
    const service = new AuthService(prisma as never, {} as never);

    await expect(
      service.register({
        email: 'customer@example.com',
        password: 'password123',
        fullName: 'Customer',
      }),
    ).rejects.toThrow('Email already registered');
  });
});
