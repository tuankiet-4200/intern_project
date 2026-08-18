import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InteractionType, Prisma, ProductStatus, ShopStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RecommendationsService } from '../recommendations/recommendations.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

const CART_INCLUDE = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      product: {
        include: {
          shop: { select: { id: true, name: true, slug: true, status: true } },
          category: { select: { id: true, name: true, slug: true } },
          inventory: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendations: RecommendationsService,
  ) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: CART_INCLUDE,
    });
    return this.presentCart(cart);
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({ where: { userId }, update: {}, create: { userId } });
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
      });
      const nextQuantity = (existing?.quantity ?? 0) + dto.quantity;
      if (nextQuantity > 99) throw new BadRequestException('Cart item quantity cannot exceed 99');
      await this.assertPurchasable(tx, dto.productId, nextQuantity);

      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: dto.productId } },
        update: { quantity: nextQuantity },
        create: { cartId: cart.id, productId: dto.productId, quantity: dto.quantity },
      });
      await this.recommendations.recordInteraction(tx, userId, dto.productId, InteractionType.ADD_TO_CART);
    });
    return this.getCart(userId);
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cart: { userId } },
      });
      if (!item) throw new NotFoundException('Cart item not found');
      await this.assertPurchasable(tx, item.productId, dto.quantity);
      await tx.cartItem.update({ where: { id: itemId }, data: { quantity: dto.quantity } });
    });
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const deleted = await this.prisma.cartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
    if (deleted.count === 0) throw new NotFoundException('Cart item not found');
    return this.getCart(userId);
  }

  async clear(userId: string) {
    await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    return this.getCart(userId);
  }

  private async assertPurchasable(client: Prisma.TransactionClient, productId: string, quantity: number) {
    const product = await client.product.findUnique({
      where: { id: productId },
      include: { shop: true, inventory: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (product.status !== ProductStatus.ACTIVE) throw new BadRequestException('Product is not active');
    if (product.shop.status !== ShopStatus.APPROVED) throw new BadRequestException('Shop is not approved');
    const available = product.inventory ? product.inventory.onHand - product.inventory.reserved : 0;
    if (available < quantity) throw new BadRequestException(`Only ${available} item(s) are available`);
  }

  private presentCart(cart: Prisma.CartGetPayload<{ include: typeof CART_INCLUDE }>) {
    let subtotal = new Prisma.Decimal(0);
    const items = cart.items.map((item) => {
      const available = item.product.inventory
        ? item.product.inventory.onHand - item.product.inventory.reserved
        : 0;
      const errors: string[] = [];
      if (item.product.status !== ProductStatus.ACTIVE) errors.push('Product is not active');
      if (item.product.shop.status !== ShopStatus.APPROVED) errors.push('Shop is not approved');
      if (available < item.quantity) errors.push(`Only ${available} item(s) are available`);
      const lineTotal = item.product.price.mul(item.quantity);
      subtotal = subtotal.add(lineTotal);
      return { ...item, available, lineTotal, isValid: errors.length === 0, errors };
    });

    return {
      id: cart.id,
      userId: cart.userId,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      isValid: items.length > 0 && items.every((item) => item.isValid),
      updatedAt: cart.updatedAt,
    };
  }
}
