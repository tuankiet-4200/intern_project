import 'dotenv/config';
import { UserRole } from '@prisma/client';
import { describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService integration', () => {
  it('maintains exactly one default address through create and delete', async () => {
    const prisma = new PrismaService();
    const users = new UsersService(prisma);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    let userId: string | undefined;

    await prisma.$connect();
    try {
      const user = await prisma.user.create({
        data: {
          email: `address-test-${suffix}@example.com`,
          passwordHash: 'not-used',
          fullName: 'Address Test User',
          role: UserRole.CUSTOMER,
        },
      });
      userId = user.id;

      const first = await users.createAddress(user.id, {
        recipient: 'First Recipient',
        phone: '0900000001',
        line1: '1 First Street',
        ward: 'Ward 1',
        district: 'District 1',
        city: 'HCM',
      });
      expect(first.isDefault).toBe(true);

      const second = await users.createAddress(user.id, {
        recipient: 'Second Recipient',
        phone: '0900000002',
        line1: '2 Second Street',
        ward: 'Ward 2',
        district: 'District 2',
        city: 'HCM',
        isDefault: true,
      });
      let addresses = await users.listAddresses(user.id);
      expect(addresses.filter((address) => address.isDefault)).toHaveLength(1);
      expect(addresses.find((address) => address.isDefault)?.id).toBe(second.id);

      await users.deleteAddress(user.id, second.id);
      addresses = await users.listAddresses(user.id);
      expect(addresses).toHaveLength(1);
      expect(addresses[0].id).toBe(first.id);
      expect(addresses[0].isDefault).toBe(true);
    } finally {
      if (userId) await prisma.user.delete({ where: { id: userId } });
      await prisma.$disconnect();
    }
  });
});
