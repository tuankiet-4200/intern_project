export type DemoVendorFixture = {
  fullName: string;
  email: string;
  password: string;
  shopName: string;
  shopSlug: string;
  description: string;
};

export type DemoProductFixture = {
  categorySlug: string;
  shopSlug: string;
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  imageUrl: string;
  sourceUrl: string;
};

export const DEMO_VENDOR_FIXTURES: DemoVendorFixture[] = [
  {
    fullName: 'Vendor Demo',
    email: 'vendor@example.com',
    password: 'password123',
    shopName: 'North Studio',
    shopSlug: 'north-studio',
    description: 'Thiết bị công nghệ và phụ kiện dành cho học tập, làm việc.',
  },
  {
    fullName: 'Mobile Hub Demo',
    email: 'vendor.mobile@example.com',
    password: 'MobileHub@2026',
    shopName: 'Mobile Hub',
    shopSlug: 'mobile-hub',
    description: 'Điện thoại, máy tính bảng và laptop chính hãng cho nhu cầu hằng ngày.',
  },
  {
    fullName: 'Tech House Demo',
    email: 'vendor.tech@example.com',
    password: 'TechHouse@2026',
    shopName: 'Tech House',
    shopSlug: 'tech-house',
    description: 'Gian hàng công nghệ đa thương hiệu với danh mục sản phẩm phong phú.',
  },
  {
    fullName: 'Digital Corner Demo',
    email: 'vendor.digital@example.com',
    password: 'DigitalCorner@2026',
    shopName: 'Digital Corner',
    shopSlug: 'digital-corner',
    description: 'Thiết bị số phục vụ giải trí, sáng tạo và làm việc linh hoạt.',
  },
];

export const DEMO_CATEGORY_FIXTURES = [
  { name: 'Điện thoại', slug: 'dien-thoai', sourceUrl: 'https://cellphones.com.vn/mobile.html', sortOrder: 10 },
  { name: 'Máy tính bảng', slug: 'may-tinh-bang', sourceUrl: 'https://cellphones.com.vn/tablet.html', sortOrder: 20 },
  { name: 'Laptop', slug: 'laptop', sourceUrl: 'https://cellphones.com.vn/laptop.html', sortOrder: 30 },
] as const;

const SOURCE_ORIGIN = 'https://cellphones.com.vn/';
const IMAGE_ORIGIN = 'https://cdn2.cellphones.com.vn/insecure/rs:fill:358:358/q:90/plain/https://cellphones.com.vn/media/catalog/product/';

type ProductInput = readonly [path: string, imagePath: string, name: string, price: number, compareAtPrice?: number];

const PHONE_PRODUCTS: ProductInput[] = [
  ['iphone-17-pro.html', 'i/p/iphone-17-pro-256-gb.png', 'iPhone 17 Pro 256GB | Chính hãng', 31990000, 34990000],
  ['iphone-17-pro-max.html', 'i/p/iphone-17-pro-max_3.jpg', 'iPhone 17 Pro Max 256GB | Chính hãng', 34590000, 37990000],
  ['iphone-17-256gb.html', 'i/p/iphone_17_256gb-3_2.jpg', 'iPhone 17 256GB | Chính hãng', 24490000, 24990000],
  ['dien-thoai-samsung-galaxy-z-fold-8-ultra.html', 's/a/samsung-galaxy-z-fold-8-violet-01.jpg', 'Samsung Galaxy Z Fold8 Ultra 5G 12GB 256GB', 50490000, 52990000],
  ['dien-thoai-samsung-galaxy-z-fold-8.html', 's/a/samsung-galaxy-z-fold-8-lavender-01.jpg', 'Samsung Galaxy Z Fold8 5G 12GB 256GB', 44490000, 46990000],
  ['dien-thoai-samsung-galaxy-s26-ultra.html', 's/a/samsung-galaxy-s26-ultra-1.jpg', 'Samsung Galaxy S26 Ultra 5G 12GB 256GB', 32490000, 36990000],
  ['dien-thoai-samsung-galaxy-s26.html', 's/a/samsung-galaxy-s26-10.jpg', 'Samsung Galaxy S26 5G 12GB 256GB', 23190000, 25990000],
  ['iphone-17-pro-max-512gb.html', 'i/p/iphone-17-pro-cam_3.jpg', 'iPhone 17 Pro Max 512GB | Chính hãng', 41490000, 44490000],
  ['iphone-16-pro-max.html', 'i/p/iphone-16-pro-max.png', 'Điện thoại iPhone 16 Pro Max 256GB', 30990000, 34990000],
  ['dien-thoai-samsung-galaxy-s25-ultra.html', 'd/i/dien-thoai-samsung-galaxy-s25-ultra_3__3.png', 'Samsung Galaxy S25 Ultra 12GB 256GB', 27490000, 33380000],
  ['dien-thoai-samsung-galaxy-z-fold-8-ultra-512gb.html', 's/a/samsung-galaxy-z-fold-8-ultra-cream_2.jpg', 'Samsung Galaxy Z Fold8 Ultra 5G 12GB 512GB', 56490000, 58990000],
  ['dien-thoai-xiaomi-redmi-note-15.html', 'r/e/redmi-note-15-series-1_3.jpg', 'Xiaomi Redmi Note 15 6GB 128GB', 5190000, 5990000],
  ['dien-thoai-samsung-galaxy-z-flip-8.html', 's/a/samsung-galaxy-z-flip-8-pink-01.jpg', 'Samsung Galaxy Z Flip8 5G 12GB 256GB', 29490000, 31990000],
  ['dien-thoai-oppo-reno16-f.html', 'o/p/oppo-reno16f-pop-white-9.jpg', 'OPPO Reno16 F 5G 8GB 256GB', 15990000],
  ['iphone-15.html', 'i/p/iphone-15-plus_1__1.png', 'iPhone 15 128GB | Chính hãng VN/A', 18890000, 19990000],
  ['dien-thoai-xiaomi-poco-x8-pro-max.html', 'x/i/xiaomi-poco-x8-pro-max_2.jpg', 'POCO X8 Pro Max 12GB 256GB', 13790000, 16990000],
  ['iphone-air-256gb.html', 'i/p/iphone_air-3_2.jpg', 'iPhone Air 256GB | Chính hãng', 22990000, 31990000],
  ['dien-thoai-xiaomi-redmi-17.html', 'x/i/xiaomi-redmi-17-black.jpg', 'Xiaomi Redmi 17 6GB 256GB', 7490000],
  ['dien-thoai-nubia-neo-5-5g.html', 'd/i/dien-thoai-nubia-neo-5-5g-den.jpg', 'Nubia Neo 5 5G 8GB 128GB', 6990000, 7490000],
  ['iphone-17-pro-max-1tb.html', 'i/p/iphone-17-pro-cam_4.jpg', 'iPhone 17 Pro Max 1TB | Chính hãng', 47990000, 50990000],
];

const TABLET_PRODUCTS: ProductInput[] = [
  ['ipad-a16-11-inch.html', 'i/p/ipad-a16-11-inch_10_.jpg', 'iPad A16 Wifi 128GB 2025 | Chính hãng Apple Việt Nam', 11990000, 12790000],
  ['ipad-a16-11-inch-256gb.html', 'i/p/ipad-a16-11-inch_10__1.jpg', 'iPad A16 Wifi 256GB 2025 | Chính hãng Apple Việt Nam', 14990000, 15590000],
  ['ipad-mini-7.html', 't/e/text_ng_n_13_7.png', 'iPad mini 7 2024 Wifi 128GB | Chính hãng Apple Việt Nam', 15610000, 16490000],
  ['may-tinh-bang-huawei-matepad-11-5-s-2026.html', 'h/u/huawei-matepad-11-5-s-2026_1.jpg', 'Huawei MatePad 11.5 S 2026 12GB 256GB - Kèm bàn phím', 16590000, 18490000],
  ['may-tinh-bang-huawei-matepad-papermate-11-5-inch.html', 'h/u/huawei-matepad-papermate-11-5-inch_1_9.jpg', 'Huawei MatePad Papermatte 11.5 inch 2025 8GB 256GB - Kèm bàn phím', 12990000, 13490000],
  ['may-tinh-bang-huawei-matepad-11-5-2026-8gb-128gb-kem-ban-phim.html', 'h/u/huawei-matepad-11-5-2026-8gb-128gb-kem-ban-phim.jpg', 'Huawei MatePad 11.5 2026 8GB 128GB, Kèm bàn phím', 10490000],
  ['may-tinh-bang-samsung-galaxy-tab-s10-lite-wifi.html', 'm/a/may-tinh-bang-samsung-galaxy-tab-a11-plus-wifi_2.jpg', 'Samsung Galaxy Tab S10 Lite Wifi 6GB 128GB', 8290000, 9990000],
  ['may-tinh-bang-xiaomi-pad-mini.html', 'x/i/xiaomi-pad-mini.jpg', 'Xiaomi Pad Mini 8GB 256GB', 13990000, 15990000],
  ['may-tinh-bang-lenovo-idea-tab-plus-wifi-8gb-128gb-zag70981vn-kem-but-ban-phim.html', 'l/e/lenovo-idea-tab-plus-wifi_1.jpg', 'Lenovo Idea Tab Plus Matte Edition Wifi 8GB 128GB ZAG70981VN - Kèm bút, bàn phím', 9890000],
  ['apple-ipad-air-m4-11-inch-128gb-wifi.html', '1/_/1_1__1_1.png', 'iPad Air 11 inch M4 Wifi 128GB 2026 | Chính hãng', 19990000, 20990000],
  ['ipad-pro-m5-11-inch-256gb.html', 'i/p/ipad-pro-m5.jpg', 'iPad Pro chip M5 11 inch Wifi 256GB | Chính hãng Apple Việt Nam', 33990000, 35590000],
  ['may-tinh-bang-honor-pad-10.html', 'h/o/honnor-pad-10.jpg', 'HONOR Pad 10 Wifi 8GB 256GB', 10990000],
  ['may-tinh-bang-lenovo-idea-tab-pro-gen-2-zahd0452vn-kem-but-ban-phim.html', 'm/a/may-tinh-bang-lenovo-legion-tab-pro-gen-2-zahd0452vn-kem-but-ban-phim.jpg', 'Lenovo Idea Tab Pro Gen 2 Matte Edition 8GB 256GB ZAHD0452VN - Kèm bút, bàn phím', 16990000],
  ['ipad-10-9-inch-2022.html', 'i/p/ipad-10-9-inch-2022.png', 'iPad Gen 10 10.9 inch 2022 Wifi 64GB | Chính hãng Apple Việt Nam', 7990000, 12990000],
  ['apple-ipad-air-m3.html', 'i/p/ipad-air-11-wifi-1.jpg', 'iPad Air 11 inch M3 Wifi 128GB 2025 | Chính hãng Apple Việt Nam', 17990000, 21490000],
  ['ipad-air-5.html', 'i/p/ipad-air-5.png', 'iPad Air 5 10.9 inch 2022 Wifi 64GB | Chính hãng Apple Việt Nam', 14390000, 16990000],
  ['may-tinh-bang-xiaomi-redmi-pad-2-wifi.html', 'x/i/xiaomi-redmi-pad-2-wifi-1.jpg', 'Xiaomi Redmi Pad 2 Wifi 6GB 128GB', 6190000, 6690000],
  ['may-tinh-bang-lenovo-legion-tab-gen-5-12gb-256gb-zah20030vn.html', 'l/e/lenovo-legion-tab-gen-5_1.jpg', 'Lenovo Legion Tab Gen 5 12GB 256GB', 23190000, 23990000],
  ['may-tinh-bang-samsung-galaxy-tab-s10-fe-wifi.html', 'm/a/may-tinh-bang-samsung-galaxy-tab-s10-fe.1_1.png', 'Samsung Galaxy Tab S10 FE Wifi 8GB 128GB', 12190000, 13690000],
  ['ipad-air-6-m2-11-inch.html', 'i/p/ipad-air-6-m2-11-inch_9_.jpg', 'iPad Air 6 M2 11 inch Wifi 128GB | Chính hãng Apple Việt Nam', 14490000, 16990000],
];

const LAPTOP_PRODUCTS: ProductInput[] = [
  ['laptop-hp-omnibook-5-ai-16-af1048tu-bz7q9pa.html', 'g/r/group_744_1_42.png', 'Laptop HP Omnibook 5 AI 16-AF1048TU BZ7Q9PA', 25990000, 27190000],
  ['macbook-neo-13-a18-pro-6-cpu-5-gpu-8gb-256gb.html', 'm/a/macbook_13_19.png', 'MacBook Neo 13 inch A18 Pro 2026 6CPU 5GPU 8GB 256GB | Chính hãng Apple Việt Nam', 18790000, 19490000],
  ['laptop-lenovo-loq-essential-15arp10e-83s0000dvn.html', 't/e/text_d_i_9_2.png', 'Laptop Lenovo LOQ Essential 15ARP10E 83S0000DVN', 25490000, 31990000],
  ['laptop-dell-14-dc14250-dc4c5386w.html', 'g/r/group_945_33.png', 'Laptop Dell 14 DC14250 DC4C5386W', 24190000, 30990000],
  ['laptop-asus-zenbook-14-ux3405ca-st648w.html', 'g/r/group_894_2_.png', 'Laptop ASUS ZenBook 14 UX3405CA-ST648W', 38590000, 41990000],
  ['macbook-air-13-m5-10-cpu-8-gpu-16gb-512gb.html', 'm/a/macbook_13_17.png', 'MacBook Air M5 13 inch 2026 10CPU 8GPU 16GB 512GB | Chính hãng Apple Việt Nam', 35490000, 35990000],
  ['laptop-asus-vivobook-14-x1407ca-ly008w.html', 't/e/text_ng_n_4__10_30.png', 'Laptop ASUS VivoBook 14 X1407CA-LY008W', 21390000, 25990000],
  ['laptop-msi-cyborg-15-a13uc-2082vn.html', 't/e/text_d_i_7_126.png', 'Laptop MSI Cyborg 15 A13UC-2082VN', 27990000, 30690000],
  ['laptop-lenovo-loq-15arp10e-83s0007avn.html', 't/e/text_d_i_8_16.png', 'Laptop Lenovo LOQ 15ARP10E 83S0007AVN', 28490000, 30490000],
  ['laptop-asus-vivobook-s14-s3407va-ly146w.html', 'g/r/group_744_1_47.png', 'Laptop ASUS Vivobook S14 S3407VA-LY146W', 20190000, 22990000],
  ['laptop-acer-aspire-lite-16-gen-2-al16-52p-76du.html', 'g/r/group_659_1__12.png', 'Laptop Acer Aspire Lite 16 GEN 2 AL16-52P-76DU', 19290000, 19990000],
  ['laptop-asus-tuf-gaming-f16-fx607vj-rl034w.html', 't/e/text_d_i_7_36.png', 'Laptop ASUS TUF Gaming F16 FX607VJ-RL034W', 22990000, 24490000],
  ['laptop-acer-gaming-aspire-7-a715-59g-57tu.html', 't/e/text_d_i_1__4_8.png', 'Laptop Acer Gaming Aspire 7 A715-59G-57TU', 23990000, 25990000],
  ['macbook-neo-13-a18-pro-6-cpu-5-gpu-8gb-512gb.html', 'm/a/macbook_1__7_10.png', 'MacBook Neo 13 inch A18 Pro 2026 6CPU 5GPU 8GB 512GB Touch ID | Chính hãng Apple Việt Nam', 21290000, 21990000],
  ['apple-macbook-air-13-m4-10cpu-8gpu-16gb-256gb-2025.html', 'm/a/macbook_11_1.png', 'MacBook Air M4 13 inch 2025 10CPU 8GPU 16GB 256GB | Chính hãng Apple Việt Nam', 24990000, 26990000],
  ['laptop-lenovo-ideapad-slim-3-14arp10-83k600e9vn.html', 'g/r/group_945_15.png', 'Laptop Lenovo IdeaPad Slim 3 14ARP10 83K600E9VN', 20490000, 23490000],
  ['laptop-dell-pro-15-essential-pv15250-vkvkd.html', 't/e/text_ng_n_2__13_50.png', 'Laptop Dell Pro 15 Essential PV15250 VKVKD - Nhập khẩu chính hãng', 14490000, 14990000],
  ['laptop-asus-tuf-gaming-a15-fa506ncg-hn329w.html', 't/e/text_d_i_9_14.png', 'Laptop ASUS TUF Gaming A15 FA506NCG-HN329W', 26990000, 37490000],
  ['macbook-air-m2-2022-16gb.html', 'i/m/image_1396_1.png', 'Apple MacBook Air M2 2024 8CPU 8GPU 16GB 256GB | Chính hãng Apple Việt Nam', 18590000, 24990000],
  ['laptop-hp-victus-15-fa2731tx-b85lnpa.html', 't/e/text_d_i_7_78.png', 'Laptop HP Victus 15-FA2731TX B85LNPA', 24990000, 29990000],
];

const PRODUCTS_BY_CATEGORY: Array<{ categorySlug: string; products: ProductInput[] }> = [
  { categorySlug: 'dien-thoai', products: PHONE_PRODUCTS },
  { categorySlug: 'may-tinh-bang', products: TABLET_PRODUCTS },
  { categorySlug: 'laptop', products: LAPTOP_PRODUCTS },
];

export const DEMO_PRODUCT_FIXTURES: DemoProductFixture[] = PRODUCTS_BY_CATEGORY.flatMap(
  ({ categorySlug, products }) => products.map(([path, imagePath, name, price, compareAtPrice], index) => ({
    categorySlug,
    shopSlug: DEMO_VENDOR_FIXTURES[index % DEMO_VENDOR_FIXTURES.length].shopSlug,
    name: name.trim(),
    slug: `demo-cps-${path.replace(/\.html$/, '')}`,
    price,
    compareAtPrice,
    imageUrl: `${IMAGE_ORIGIN}${imagePath}`,
    sourceUrl: `${SOURCE_ORIGIN}${path}`,
  })),
);

export const DEMO_SNAPSHOT_DATE = '2026-08-19';
