import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InventoryReason, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto, ReserveInventoryDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  private static readonly MAX_WRITE_ATTEMPTS = 3;

  constructor(private readonly prisma: PrismaService) {}

  async getByProduct(requesterId: string, requesterRole: string, productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: { select: { shop: { select: { ownerId: true } } } },
        ledger: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!inventory) throw new NotFoundException('Inventory not found');
    const { product, ...safeInventory } = inventory;
    if (requesterRole !== UserRole.ADMIN && product.shop.ownerId !== requesterId) {
      throw new ForbiddenException('Not your product');
    }

    return {
      ...safeInventory,
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

    for (let attempt = 0; attempt < InventoryService.MAX_WRITE_ATTEMPTS; attempt += 1) {
      const result = await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({ where: { id: product.inventory!.id } });
        if (!inventory) throw new NotFoundException('Inventory not found');

        const nextOnHand = inventory.onHand + dto.quantity;
        if (nextOnHand < inventory.reserved) {
          throw new BadRequestException('On-hand stock cannot be lower than reserved stock');
        }

        const updatedRows = await tx.inventory.updateMany({
          where: { id: inventory.id, onHand: inventory.onHand, reserved: inventory.reserved },
          data: { onHand: nextOnHand },
        });
        if (updatedRows.count === 0) return null;

        const updated = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
        await tx.inventoryLedger.create({
          data: {
            inventoryId: inventory.id,
            deltaOnHand: dto.quantity,
            reason: dto.reason,
            note: dto.note,
          },
        });

        return { ...updated, available: updated.onHand - updated.reserved };
      });

      if (result) return result;
    }

    throw new ConflictException('Inventory changed concurrently; please retry');
  }

  async reserve(productId: string, dto: ReserveInventoryDto) {
    for (let attempt = 0; attempt < InventoryService.MAX_WRITE_ATTEMPTS; attempt += 1) {
      const result = await this.prisma.$transaction(async (tx) => {
        const inventory = await tx.inventory.findUnique({ where: { productId } });
        if (!inventory) throw new NotFoundException('Inventory not found');

        const available = inventory.onHand - inventory.reserved;
        if (available < dto.quantity) throw new BadRequestException('Insufficient stock');

        const updatedRows = await tx.inventory.updateMany({
          where: { id: inventory.id, onHand: inventory.onHand, reserved: inventory.reserved },
          data: { reserved: { increment: dto.quantity } },
        });
        if (updatedRows.count === 0) return null;

        const updated = await tx.inventory.findUniqueOrThrow({ where: { id: inventory.id } });
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

      if (result) return result;
    }

    throw new ConflictException('Inventory changed concurrently; please retry');
  }
}
