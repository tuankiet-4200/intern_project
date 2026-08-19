import {
  ChatSenderType,
  CouponScope,
  CouponType,
  InventoryReason,
  PrismaClient,
  ProductStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password123';

async function upsertUser(email: string, fullName: string, role: UserRole, passwordHash: string) {
  return prisma.user.upsert({
    where: { email },
    update: { fullName, role, status: 'ACTIVE' },
    create: { email, fullName, role, passwordHash },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const [admin, vendor, customer] = await Promise.all([
    upsertUser('admin@example.com', 'Admin Demo', UserRole.ADMIN, passwordHash),
    upsertUser('vendor@example.com', 'Vendor Demo', UserRole.VENDOR, passwordHash),
    upsertUser('customer@example.com', 'Customer Demo', UserRole.CUSTOMER, passwordHash),
  ]);

  const shop = await prisma.shop.upsert({
    where: { slug: 'north-studio' },
    update: { ownerId: vendor.id, name: 'North Studio', status: ShopStatus.APPROVED },
    create: {
      ownerId: vendor.id,
      name: 'North Studio',
      slug: 'north-studio',
      description: 'Approved demo shop',
      status: ShopStatus.APPROVED,
    },
  });

  const addressCount = await prisma.userAddress.count({ where: { userId: customer.id } });
  if (addressCount === 0) {
    await prisma.userAddress.create({
      data: {
        userId: customer.id,
        recipient: customer.fullName,
        phone: '0900000000',
        line1: '1 Demo Street',
        ward: 'Demo Ward',
        district: 'Demo District',
        city: 'Ho Chi Minh City',
        isDefault: true,
      },
    });
  }

  await prisma.$transaction([
    prisma.coupon.updateMany({
      where: { code: 'WELCOME10' },
      data: { isActive: false },
    }),
    prisma.coupon.upsert({
      where: { code: 'WELCOME2K' },
      update: { isActive: true },
      create: {
        code: 'WELCOME2K',
        scope: CouponScope.GLOBAL,
        type: CouponType.FIXED_AMOUNT,
        value: 2000,
        isActive: true,
      },
    }),
  ]);

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: 'fashion' },
      update: { name: 'Fashion', isActive: true },
      create: { name: 'Fashion', slug: 'fashion' },
    }),
    prisma.category.upsert({
      where: { slug: 'home-living' },
      update: { name: 'Home & Living', isActive: true },
      create: { name: 'Home & Living', slug: 'home-living' },
    }),
  ]);

  const productSeeds = [
    {
      name: 'Everyday Cotton Shirt',
      slug: 'everyday-cotton-shirt',
      price: 329000,
      categoryId: categories[0].id,
      onHand: 42,
    },
    {
      name: 'Modular Desk Lamp',
      slug: 'modular-desk-lamp',
      price: 590000,
      categoryId: categories[1].id,
      onHand: 18,
    },
  ];

  for (const seed of productSeeds) {
    const product = await prisma.product.upsert({
      where: { slug: seed.slug },
      update: {
        shopId: shop.id,
        categoryId: seed.categoryId,
        name: seed.name,
        price: seed.price,
        status: ProductStatus.ACTIVE,
      },
      create: {
        shopId: shop.id,
        categoryId: seed.categoryId,
        name: seed.name,
        slug: seed.slug,
        price: seed.price,
        status: ProductStatus.ACTIVE,
      },
    });

    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        onHand: seed.onHand,
        ledger: {
          create: {
            deltaOnHand: seed.onHand,
            reason: InventoryReason.INITIAL_STOCK,
            note: 'Demo seed stock',
          },
        },
      },
    });
  }

  const conversation = await prisma.chatConversation.upsert({
    where: { shopId_customerId: { shopId: shop.id, customerId: customer.id } },
    update: {},
    create: { shopId: shop.id, customerId: customer.id },
  });
  const customerMessage = await prisma.chatMessage.upsert({
    where: {
      conversationId_clientMessageId: {
        conversationId: conversation.id,
        clientMessageId: '00000000-0000-4000-8000-000000000101',
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      senderUserId: customer.id,
      senderType: ChatSenderType.CUSTOMER,
      clientMessageId: '00000000-0000-4000-8000-000000000101',
      content: 'Shop tư vấn giúp mình một sản phẩm dùng cho góc làm việc nhé.',
    },
  });
  const shopMessage = await prisma.chatMessage.upsert({
    where: {
      conversationId_clientMessageId: {
        conversationId: conversation.id,
        clientMessageId: '00000000-0000-4000-8000-000000000102',
      },
    },
    update: {},
    create: {
      conversationId: conversation.id,
      senderUserId: vendor.id,
      senderType: ChatSenderType.SHOP,
      clientMessageId: '00000000-0000-4000-8000-000000000102',
      content: 'Bạn có thể tham khảo Modular Desk Lamp đang còn hàng tại shop nhé.',
    },
  });
  await prisma.chatConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: shopMessage.createdAt,
      customerLastReadAt: customerMessage.createdAt,
      shopLastReadAt: shopMessage.createdAt,
    },
  });

  console.log(`Seeded admin ${admin.email}, vendor ${vendor.email}, customer ${customer.email}`);
  console.log(`Demo password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
