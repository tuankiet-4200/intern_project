import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InventoryReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto, ReserveInventoryDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProduct(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { ledger: { orderBy: { createdAt: 'desc' }, take: 50 } },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    return {
      ...inventory,
      available: inventory.onHand - inventory.reserved,
    };
  }

  async adjust(ownerId: string, productId: string, dto: AdjustInventoryDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { shop: true, inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.shop.ownerId !== ownerId) throw new ForbiddenException('Not your product');
    if (!product.inventory) throw new NotFoundException('Inventory not found');

    const nextOnHand = product.inventory.onHand + dto.quantity;
    if (nextOnHand < product.inventory.reserved) {
      throw new BadRequestException('On-hand stock cannot be lower than reserved stock');
    }

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.update({
        where: { id: product.inventory!.id },
        data: { onHand: nextOnHand },
      });

      await tx.inventoryLedger.create({
        data: {
          inventoryId: inventory.id,
          deltaOnHand: dto.quantity,
          reason: dto.reason,
          note: dto.note,
        },
      });

      return { ...inventory, available: inventory.onHand - inventory.reserved };
    });
  }

  async reserve(productId: string, dto: ReserveInventoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { productId } });
      if (!inventory) throw new NotFoundException('Inventory not found');

      const available = inventory.onHand - inventory.reserved;
      if (available < dto.quantity) throw new BadRequestException('Insufficient stock');

      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { reserved: inventory.reserved + dto.quantity },
      });

      await tx.inventoryLedger.create({
        data: {
          inventoryId: inventory.id,
          deltaReserve: dto.quantity,
          reason: InventoryReason.ORDER_RESERVED,
          referenceId: dto.referenceId,
        },
      });

      return { ...updated, available: updated.onHand - updated.reserved };
    });
  }
}
