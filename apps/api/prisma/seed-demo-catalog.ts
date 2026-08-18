import {
  InventoryReason,
  Prisma,
  PrismaClient,
  ProductStatus,
  ShopStatus,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import {
  DEMO_CATEGORY_FIXTURES,
  DEMO_PRODUCT_FIXTURES,
  DEMO_SNAPSHOT_DATE,
  DEMO_VENDOR_FIXTURES,
} from '../src/common/demo-catalog-data';

const prisma = new PrismaClient();

function assertExplicitProductionOptIn() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_CATALOG_SEED !== 'true') {
    throw new Error(
      'Refusing to add demo accounts/catalog in production. Re-run with ALLOW_DEMO_CATALOG_SEED=true after confirming this is intentional.',
    );
  }
}

function initialStock(index: number) {
  return 25 + ((index * 7) % 56);
}

async function seedVendors() {
  const shops = new Map<string, { id: string }>();
  for (const fixture of DEMO_VENDOR_FIXTURES) {
    const passwordHash = await bcrypt.hash(fixture.password, 12);
    const owner = await prisma.user.upsert({
      where: { email: fixture.email },
      update: { fullName: fixture.fullName, role: UserRole.VENDOR, status: 'ACTIVE', passwordHash },
      create: {
        email: fixture.email,
        fullName: fixture.fullName,
        role: UserRole.VENDOR,
        status: 'ACTIVE',
        passwordHash,
      },
    });
    const shop = await prisma.shop.upsert({
      where: { slug: fixture.shopSlug },
      update: {
        ownerId: owner.id,
        name: fixture.shopName,
        description: fixture.description,
        status: ShopStatus.APPROVED,
      },
      create: {
        ownerId: owner.id,
        name: fixture.shopName,
        slug: fixture.shopSlug,
        description: fixture.description,
        status: ShopStatus.APPROVED,
      },
      select: { id: true },
    });
    shops.set(fixture.shopSlug, shop);
  }
  return shops;
}

async function seedCategories() {
  const categories = new Map<string, { id: number }>();
  for (const fixture of DEMO_CATEGORY_FIXTURES) {
    const category = await prisma.category.upsert({
      where: { slug: fixture.slug },
      update: {
        name: fixture.name,
        description: `Danh mục demo tham khảo từ ${fixture.sourceUrl}.`,
        sortOrder: fixture.sortOrder,
        isActive: true,
      },
      create: {
        name: fixture.name,
        slug: fixture.slug,
        description: `Danh mục demo tham khảo từ ${fixture.sourceUrl}.`,
        sortOrder: fixture.sortOrder,
        isActive: true,
      },
      select: { id: true },
    });
    categories.set(fixture.slug, category);
  }
  return categories;
}

async function seedProducts(shops: Map<string, { id: string }>, categories: Map<string, { id: number }>) {
  for (const [index, fixture] of DEMO_PRODUCT_FIXTURES.entries()) {
    const shop = shops.get(fixture.shopSlug);
    const category = categories.get(fixture.categorySlug);
    if (!shop || !category) throw new Error(`Invalid demo fixture relationship for ${fixture.slug}`);

    const product = await prisma.product.upsert({
      where: { slug: fixture.slug },
      update: {
        shopId: shop.id,
        categoryId: category.id,
        name: fixture.name,
        description: 'Dữ liệu snapshot phục vụ kiểm thử nội bộ. Giá và tình trạng thực tế có thể đã thay đổi.',
        status: ProductStatus.ACTIVE,
        price: fixture.price,
        compareAtPrice: fixture.compareAtPrice ?? null,
        images: [fixture.imageUrl],
        attributes: {
          'Nguồn tham khảo': fixture.sourceUrl,
          'Ngày snapshot': DEMO_SNAPSHOT_DATE,
          'Loại dữ liệu': 'Demo, không đồng bộ tự động',
        } satisfies Prisma.InputJsonObject,
      },
      create: {
        shopId: shop.id,
        categoryId: category.id,
        name: fixture.name,
        slug: fixture.slug,
        description: 'Dữ liệu snapshot phục vụ kiểm thử nội bộ. Giá và tình trạng thực tế có thể đã thay đổi.',
        status: ProductStatus.ACTIVE,
        price: fixture.price,
        compareAtPrice: fixture.compareAtPrice,
        images: [fixture.imageUrl],
        attributes: {
          'Nguồn tham khảo': fixture.sourceUrl,
          'Ngày snapshot': DEMO_SNAPSHOT_DATE,
          'Loại dữ liệu': 'Demo, không đồng bộ tự động',
        } satisfies Prisma.InputJsonObject,
      },
      select: { id: true },
    });

    const stock = initialStock(index);
    await prisma.inventory.upsert({
      where: { productId: product.id },
      update: {},
      create: {
        productId: product.id,
        onHand: stock,
        ledger: {
          create: {
            deltaOnHand: stock,
            reason: InventoryReason.INITIAL_STOCK,
            note: `CellphoneS demo snapshot ${DEMO_SNAPSHOT_DATE}`,
          },
        },
      },
    });
  }
}

async function main() {
  assertExplicitProductionOptIn();
  const shops = await seedVendors();
  const categories = await seedCategories();
  await seedProducts(shops, categories);

  console.log(
    `Demo catalog ready: ${DEMO_VENDOR_FIXTURES.length} vendors, ${DEMO_CATEGORY_FIXTURES.length} categories, ${DEMO_PRODUCT_FIXTURES.length} products.`,
  );
  console.log('Credentials are documented in docs/demo-vendor-accounts.docx.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
