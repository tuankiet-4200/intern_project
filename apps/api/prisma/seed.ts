import {
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
