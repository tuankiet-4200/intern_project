import 'dotenv/config';
import { AccountStatus, ShopStatus, UserRole } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaService } from '../../prisma/prisma.service';
import { ShopsService } from '../shops/shops.service';
import { UsersService } from './users.service';

describe('Admin user and shop governance integration', () => {
  const prisma = new PrismaService();
  const users = new UsersService(prisma);
  const shops = new ShopsService(prisma);
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emails = [
    `governance-admin-${nonce}@example.com`,
    `governance-vendor-${nonce}@example.com`,
    `governance-owner-${nonce}@example.com`,
  ];
  let adminId: string;
  let vendorId: string;
  let ownerId: string;
  let approvedShopId: string;
  let pendingShopId: string;

  beforeAll(async () => {
    await prisma.$connect();
    const [admin, vendor, owner] = await Promise.all([
      prisma.user.create({ data: { email: emails[0], passwordHash: 'test-only', fullName: 'Governance Admin', role: UserRole.ADMIN } }),
      prisma.user.create({ data: { email: emails[1], passwordHash: 'test-only', fullName: 'Governance Vendor', role: UserRole.VENDOR } }),
      prisma.user.create({ data: { email: emails[2], passwordHash: 'test-only', fullName: 'Governance Owner' } }),
    ]);
    adminId = admin.id;
    vendorId = vendor.id;
    ownerId = owner.id;
    const [approved, pending] = await Promise.all([
      prisma.shop.create({ data: { ownerId: vendorId, name: `Approved ${nonce}`, slug: `approved-${nonce}`, status: ShopStatus.APPROVED } }),
      prisma.shop.create({ data: { ownerId, name: `Pending ${nonce}`, slug: `pending-${nonce}` } }),
    ]);
    approvedShopId = approved.id;
    pendingShopId = pending.id;
    await prisma.refreshSession.create({
      data: { userId: vendorId, tokenHash: nonce.padEnd(64, '0').slice(0, 64), expiresAt: new Date(Date.now() + 86_400_000) },
    });
  });

  afterAll(async () => {
    await prisma.adminAuditLog.deleteMany({ where: { actorId: adminId } });
    await prisma.shop.deleteMany({ where: { id: { in: [approvedShopId, pendingShopId] } } });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await prisma.$disconnect();
  });

  it('bans a user atomically, revokes sessions, suspends approved shops and preserves an audit record', async () => {
    const updated = await users.adminUpdateStatus(adminId, vendorId, {
      status: AccountStatus.BANNED,
      reason: 'Repeated policy violations',
    });
    expect(updated.status).toBe(AccountStatus.BANNED);
    await expect(prisma.shop.findUniqueOrThrow({ where: { id: approvedShopId } }))
      .resolves.toEqual(expect.objectContaining({ status: ShopStatus.SUSPENDED }));
    const session = await prisma.refreshSession.findFirstOrThrow({ where: { userId: vendorId } });
    expect(session.revokedAt).not.toBeNull();
    const detail = await users.adminDetail(vendorId);
    expect(detail.auditLogs[0]).toEqual(expect.objectContaining({ reason: 'Repeated policy violations' }));
    const suspendedShop = await shops.adminDetail(approvedShopId);
    expect(suspendedShop.auditLogs[0]).toEqual(expect.objectContaining({
      reason: 'Owner account banned: Repeated policy violations',
    }));

    await users.adminUpdateStatus(adminId, vendorId, { status: AccountStatus.ACTIVE, reason: 'Appeal accepted' });
    await expect(prisma.shop.findUniqueOrThrow({ where: { id: approvedShopId } }))
      .resolves.toEqual(expect.objectContaining({ status: ShopStatus.SUSPENDED }));
  });

  it('lists filtered users and applies explicit audited shop transitions', async () => {
    const page = await users.adminList({ search: emails[2], role: UserRole.CUSTOMER, page: 1, limit: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBe(ownerId);

    await shops.adminUpdateStatus(adminId, pendingShopId, { status: ShopStatus.APPROVED });
    await expect(prisma.user.findUniqueOrThrow({ where: { id: ownerId } }))
      .resolves.toEqual(expect.objectContaining({ role: UserRole.VENDOR }));
    await shops.adminUpdateStatus(adminId, pendingShopId, {
      status: ShopStatus.SUSPENDED,
      reason: 'Catalog requires investigation',
    });
    const detail = await shops.adminDetail(pendingShopId);
    expect(detail.status).toBe(ShopStatus.SUSPENDED);
    expect(detail.auditLogs).toHaveLength(2);
    const shopPage = await shops.adminList({ status: ShopStatus.SUSPENDED, page: 1, limit: 20 });
    expect(shopPage.items.map((shop) => shop.id)).toEqual(expect.arrayContaining([approvedShopId, pendingShopId]));
  });
});
