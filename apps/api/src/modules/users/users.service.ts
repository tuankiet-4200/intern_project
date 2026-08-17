import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountStatus, AdminActionType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminUserQueryDto, UpdateUserStatusDto } from './dto/admin-users.dto';
import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './dto/users.dto';

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.getProfile(userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { fullName: dto.fullName, phone: dto.phone },
      select: SAFE_USER_SELECT,
    });
  }

  async adminList(query: AdminUserQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role,
      status: query.status,
      ...(search ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: {
          ...SAFE_USER_SELECT,
          _count: { select: { shops: true, orders: true, reviews: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
  }

  async adminDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...SAFE_USER_SELECT,
        shops: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, slug: true, status: true, rating: true, createdAt: true },
        },
        _count: { select: { addresses: true, orders: true, reviews: true, chatMessages: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const auditLogs = await this.prisma.adminAuditLog.findMany({
      where: { targetType: 'User', targetId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { actor: { select: { id: true, fullName: true, email: true } } },
    });
    return { ...user, auditLogs };
  }

  async adminUpdateStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    if (adminId === userId) throw new ForbiddenException('You cannot change your own account status');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: SAFE_USER_SELECT });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === dto.status) return user;
    if (dto.status === AccountStatus.BANNED && !dto.reason?.trim()) {
      throw new BadRequestException('A reason is required when banning an account');
    }
    if (user.role === UserRole.ADMIN && dto.status === AccountStatus.BANNED) {
      const activeAdmins = await this.prisma.user.count({ where: { role: UserRole.ADMIN, status: AccountStatus.ACTIVE } });
      if (activeAdmins <= 1) throw new BadRequestException('The last active admin account cannot be banned');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const shopsToSuspend = dto.status === AccountStatus.BANNED
        ? await tx.shop.findMany({ where: { ownerId: userId, status: 'APPROVED' }, select: { id: true } })
        : [];
      const updated = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status },
        select: SAFE_USER_SELECT,
      });
      if (dto.status === AccountStatus.BANNED) {
        await tx.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
        await tx.shop.updateMany({
          where: { id: { in: shopsToSuspend.map((shop) => shop.id) } },
          data: { status: 'SUSPENDED' },
        });
        if (shopsToSuspend.length > 0) {
          await tx.adminAuditLog.createMany({
            data: shopsToSuspend.map((shop) => ({
              actorId: adminId,
              action: AdminActionType.SHOP_STATUS_CHANGED,
              targetType: 'Shop',
              targetId: shop.id,
              reason: `Owner account banned: ${dto.reason!.trim()}`,
              before: { status: 'APPROVED' },
              after: { status: 'SUSPENDED', source: 'OWNER_ACCOUNT_BANNED', ownerId: userId },
            })),
          });
        }
      }
      await tx.adminAuditLog.create({
        data: {
          actorId: adminId,
          action: AdminActionType.USER_STATUS_CHANGED,
          targetType: 'User',
          targetId: userId,
          reason: dto.reason?.trim() || null,
          before: { status: user.status },
          after: { status: dto.status, suspendedShopIds: shopsToSuspend.map((shop) => shop.id) },
        },
      });
      return updated;
    });
  }

  listAddresses(userId: string) {
    return this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const addressCount = await tx.userAddress.count({ where: { userId } });
      const isDefault = dto.isDefault === true || addressCount === 0;
      if (isDefault) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.create({
        data: {
          userId,
          recipient: dto.recipient,
          phone: dto.phone,
          line1: dto.line1,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault,
        },
      });
    });
  }

  updateAddress(userId: string, addressId: string, dto: UpdateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new NotFoundException('Address not found');
      if (address.isDefault && dto.isDefault === false) {
        throw new BadRequestException('Choose another default address instead');
      }
      if (dto.isDefault === true) {
        await tx.userAddress.updateMany({
          where: { userId, isDefault: true, id: { not: addressId } },
          data: { isDefault: false },
        });
      }

      return tx.userAddress.update({
        where: { id: addressId },
        data: {
          recipient: dto.recipient,
          phone: dto.phone,
          line1: dto.line1,
          ward: dto.ward,
          district: dto.district,
          city: dto.city,
          isDefault: dto.isDefault,
        },
      });
    });
  }

  deleteAddress(userId: string, addressId: string) {
    return this.prisma.$transaction(async (tx) => {
      const address = await tx.userAddress.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new NotFoundException('Address not found');

      await tx.userAddress.delete({ where: { id: addressId } });
      if (address.isDefault) {
        const replacement = await tx.userAddress.findFirst({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
        });
        if (replacement) {
          await tx.userAddress.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });
        }
      }

      return { deleted: true };
    });
  }
}
