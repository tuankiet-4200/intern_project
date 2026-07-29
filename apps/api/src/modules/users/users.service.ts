import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
