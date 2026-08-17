'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd, getSession, subscribeSession } from '@/lib/api';
import {
  availableStock,
  discountPercentage,
  normalizeCartQuantity,
  productAttributes,
  productDetailApiPath,
  productDetailPath,
} from '@/lib/product-detail';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Minus,
  PackageCheck,
  PackageSearch,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  compareAtPrice: string | null;
  images: string[];
  attributes: unknown;
  createdAt: string;
  shop: { id: string; name: string; slug: string; status: string };
  category: { id: number; name: string; slug: string };
  inventory: { onHand: number; reserved: number; sold: number };
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  user: { fullName: string };
};

type ReviewPage = {
  items: Review[];
  total: number;
  averageRating: number;
};

type RelatedProduct = Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'images'> & {
  shop: { name: string };
  category: { name: string };
};

export default function ProductDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const session = useSyncExternalStore(subscribeSession, getSession, () => null);
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ReviewPage>({ items: [], total: 0, averageRating: 0 });
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [reviewsUnavailable, setReviewsUnavailable] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    setReviewsUnavailable(false);
    try {
      const productResult = await apiRequest<Product | null>(productDetailApiPath(slug));
      if (!productResult) {
        setProduct(null);
        setNotFound(true);
        return;
      }
      setProduct(productResult);
      setSelectedImage(0);
      setQuantity(1);

      const [reviewResult, relatedResult] = await Promise.allSettled([
        apiRequest<ReviewPage>(`/products/${productResult.id}/reviews?limit=20`),
        apiRequest<{ items: RelatedProduct[] }>(`/products?categoryId=${productResult.category.id}&limit=5`),
      ]);
      setReviews(reviewResult.status === 'fulfilled' ? reviewResult.value : { items: [], total: 0, averageRating: 0 });
      setReviewsUnavailable(reviewResult.status === 'rejected');
      setRelatedProducts(relatedResult.status === 'fulfilled'
        ? relatedResult.value.items.filter((item) => item.id !== productResult.id).slice(0, 4)
        : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải thông tin sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const available = product ? availableStock(product.inventory.onHand, product.inventory.reserved) : 0;
  const discount = product ? discountPercentage(product.price, product.compareAtPrice) : 0;
  const attributes = useMemo(() => productAttributes(product?.attributes), [product?.attributes]);

  async function addToCart() {
    if (!product) return;
    if (!session) {
      setActionMessage({ type: 'error', text: 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.' });
      return;
    }
    setAdding(true);
    setActionMessage(null);
    try {
      await apiRequest('/cart/items', {
        method: 'POST',
        body: JSON.stringify({ productId: product.id, quantity }),
      }, true);
      setActionMessage({ type: 'success', text: `Đã thêm ${quantity} sản phẩm vào giỏ hàng.` });
    } catch (requestError) {
      setActionMessage({
        type: 'error',
        text: requestError instanceof Error ? requestError.message : 'Không thể thêm sản phẩm vào giỏ hàng.',
      });
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <ProductLoading />;

  if (notFound) {
    return (
      <AppShell>
        <section className="surface-card mx-auto grid min-h-[420px] max-w-2xl place-items-center p-8 text-center">
          <div><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><PackageSearch size={30} /></span><h1 className="mt-5 text-2xl font-black">Sản phẩm không còn hiển thị</h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Sản phẩm có thể đã hết hàng, ngừng bán hoặc cửa hàng đang tạm dừng hoạt động.</p><Link href="/" className="button-primary mt-6"><ArrowLeft size={17} /> Quay lại marketplace</Link></div>
        </section>
      </AppShell>
    );
  }

  if (error || !product) {
    return (
      <AppShell>
        <section className="surface-card mx-auto max-w-2xl p-8 text-center"><PackageSearch className="mx-auto text-red-500" size={34} /><h1 className="mt-4 text-2xl font-black">Chưa thể tải sản phẩm</h1><p className="mt-2 text-sm text-[var(--muted)]">{error || 'Đã có lỗi không xác định.'}</p><button className="button-primary mt-6" onClick={() => void load()}>Thử lại</button></section>
      </AppShell>
    );
  }

  const activeImage = product.images[selectedImage];

  return (
    <AppShell>
      <nav className="mb-6 flex items-center gap-2 overflow-hidden text-sm text-[var(--muted)]" aria-label="Breadcrumb">
        <Link href="/" className="shrink-0 transition hover:text-[var(--accent)]">Marketplace</Link><ChevronRight size={14} />
        <Link href="/#catalog" className="shrink-0 transition hover:text-[var(--accent)]">{product.category.name}</Link><ChevronRight size={14} />
        <span className="truncate font-semibold text-[var(--foreground)]">{product.name}</span>
      </nav>

      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.92fr)] lg:gap-10">
        <div>
          <div
            className="relative aspect-square overflow-hidden rounded-[28px] border border-[var(--line)] bg-gradient-to-br from-[#d9eee5] via-[#eef3df] to-[#efd8bc] bg-cover bg-center shadow-[var(--shadow-sm)] sm:aspect-[5/4]"
            style={activeImage ? { backgroundImage: `url(${JSON.stringify(activeImage)})` } : undefined}
          >
            {!activeImage ? <span className="absolute inset-0 grid place-items-center text-[#244b40]/18"><PackageSearch size={110} strokeWidth={1} /></span> : null}
            <div className="absolute left-5 top-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-extrabold text-[#315248] shadow-sm backdrop-blur">{product.category.name}</span>
              {discount > 0 ? <span className="rounded-full bg-[#e8573d] px-3 py-1.5 text-xs font-extrabold text-white shadow-sm">-{discount}%</span> : null}
            </div>
          </div>

          {product.images.length > 1 ? (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {product.images.slice(0, 5).map((image, index) => (
                <button key={`${image}-${index}`} type="button" className={`aspect-square rounded-xl border-2 bg-[#eef3ef] bg-cover bg-center transition ${selectedImage === index ? 'border-[var(--accent)]' : 'border-transparent hover:border-[#b8cbc2]'}`} style={{ backgroundImage: `url(${JSON.stringify(image)})` }} onClick={() => setSelectedImage(index)} aria-label={`Xem ảnh ${index + 1}`} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="lg:py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[var(--accent-strong)]">Đang bán</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-[var(--muted)] ring-1 ring-[var(--line)]">Còn {available} sản phẩm</span>
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight tracking-[-0.04em] sm:text-4xl lg:text-[44px]">{product.name}</h1>
          <Link href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm">
            <Stars rating={reviews.averageRating} />
            <strong>{reviews.averageRating ? reviews.averageRating.toFixed(1) : 'Chưa có điểm'}</strong>
            <span className="text-[var(--muted)]">({reviews.total} đánh giá)</span>
          </Link>

          <div className="mt-6 flex flex-wrap items-baseline gap-3 border-y border-[var(--line)] py-5">
            <span className="text-3xl font-black text-[var(--accent-strong)]">{formatVnd(product.price)}</span>
            {discount > 0 && product.compareAtPrice ? <span className="text-base text-[var(--muted)] line-through">{formatVnd(product.compareAtPrice)}</span> : null}
          </div>

          <Link href="#shop" className="mt-6 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-4 transition hover:border-[#b6ccc2]">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#123b31] text-emerald-300"><Store size={22} /></span>
            <span className="min-w-0"><span className="block text-xs font-semibold text-[var(--muted)]">Được bán bởi</span><span className="mt-0.5 block truncate font-extrabold">{product.shop.name}</span></span>
            <span className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-700"><ShieldCheck size={15} /> Đã duyệt</span>
          </Link>

          {session?.user.role !== 'ADMIN' ? (
            <div className="mt-6 rounded-2xl bg-[#edf5f1] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Số lượng</p><div className="mt-2 inline-flex items-center rounded-xl border border-[#cadcd3] bg-white p-1"><button className="icon-button !h-9 !w-9 !border-0" onClick={() => setQuantity((current) => normalizeCartQuantity(current - 1, available))} disabled={quantity <= 1} aria-label="Giảm số lượng"><Minus size={16} /></button><span className="min-w-12 text-center text-sm font-black">{quantity}</span><button className="icon-button !h-9 !w-9 !border-0" onClick={() => setQuantity((current) => normalizeCartQuantity(current + 1, available))} disabled={quantity >= available} aria-label="Tăng số lượng"><Plus size={16} /></button></div></div>
                <p className="text-right text-xs leading-5 text-[var(--muted)]">Tối đa <strong className="text-[var(--foreground)]">{available}</strong><br />sản phẩm khả dụng</p>
              </div>
              <button className="button-primary mt-4 h-12 w-full" disabled={adding || available < 1} onClick={() => void addToCart()}>{adding ? <><span className="loading-spinner !h-5 !w-5 !border-2 !border-white/40 !border-t-white" /> Đang thêm…</> : <><ShoppingCart size={18} /> Thêm vào giỏ hàng</>}</button>
              {actionMessage ? <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${actionMessage.type === 'success' ? 'bg-white text-emerald-800' : 'bg-red-50 text-red-800'}`}><span className="flex items-center gap-2">{actionMessage.type === 'success' ? <Check size={16} /> : null}{actionMessage.text}</span>{actionMessage.type === 'error' && !session ? <Link href="/login" className="shrink-0 font-bold underline">Đăng nhập</Link> : null}</div> : null}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Bạn đang xem sản phẩm công khai bằng tài khoản Admin. Chức năng mua hàng không áp dụng cho vai trò này.</div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-2">
            <Assurance icon={ShieldCheck} label="Shop kiểm duyệt" />
            <Assurance icon={Truck} label="Theo dõi đơn" />
            <Assurance icon={RotateCcw} label="Trạng thái rõ ràng" />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <article className="surface-card p-6 sm:p-8">
            <p className="eyebrow">Thông tin sản phẩm</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Mô tả chi tiết</h2>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[var(--muted)]">{product.description || 'Nhà bán chưa bổ sung mô tả chi tiết cho sản phẩm này.'}</p>
            {attributes.length ? <dl className="mt-7 grid overflow-hidden rounded-2xl border border-[var(--line)] sm:grid-cols-2">{attributes.map((attribute) => <div key={attribute.key} className="grid grid-cols-[0.8fr_1.2fr] gap-3 border-b border-[var(--line)] p-3.5 last:border-b-0 sm:odd:border-r"><dt className="text-sm font-semibold capitalize text-[var(--muted)]">{attribute.key}</dt><dd className="text-sm font-bold">{attribute.value}</dd></div>)}</dl> : null}
          </article>

          <article id="reviews" className="surface-card scroll-mt-28 p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="eyebrow">Khách hàng nhận xét</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Đánh giá sản phẩm</h2></div><div className="flex items-center gap-3"><span className="text-4xl font-black">{reviews.averageRating ? reviews.averageRating.toFixed(1) : '—'}</span><div><Stars rating={reviews.averageRating} /><p className="mt-1 text-xs text-[var(--muted)]">Từ {reviews.total} đánh giá</p></div></div></div>
            {reviewsUnavailable ? <div className="mt-7 rounded-2xl bg-amber-50 p-6 text-center text-sm text-amber-900">Chưa thể tải đánh giá lúc này. <button className="font-bold underline" onClick={() => void load()}>Thử lại</button></div> : reviews.items.length ? <div className="mt-7 grid gap-4">{reviews.items.map((review) => <ReviewCard key={review.id} review={review} />)}</div> : <div className="mt-7 rounded-2xl bg-[#f5f8f6] p-7 text-center"><Star className="mx-auto text-amber-500" size={28} /><h3 className="mt-3 font-extrabold">Chưa có đánh giá</h3><p className="mt-1 text-sm text-[var(--muted)]">Đánh giá đầu tiên sẽ xuất hiện sau khi đơn hàng được giao.</p></div>}
            {reviews.total > reviews.items.length ? <p className="mt-5 text-center text-xs text-[var(--muted)]">Đang hiển thị {reviews.items.length}/{reviews.total} đánh giá mới nhất.</p> : null}
          </article>
        </div>

        <aside id="shop" className="surface-card h-fit scroll-mt-28 p-6 lg:sticky lg:top-24">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#123b31] text-emerald-300"><Store size={22} /></span><p className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">Gian hàng</p><h2 className="mt-1 text-xl font-black">{product.shop.name}</h2><p className="mt-3 text-sm leading-6 text-[var(--muted)]">Cửa hàng đã được Admin kiểm duyệt và đang hoạt động trên Intern Market.</p>
          <div className="mt-5 grid gap-3 border-t border-[var(--line)] pt-5"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="text-emerald-600" size={17} /> Trạng thái APPROVED</p><p className="flex items-center gap-2 text-sm font-semibold"><PackageCheck className="text-emerald-600" size={17} /> Tồn kho được kiểm tra thật</p></div>
        </aside>
      </section>

      {relatedProducts.length ? (
        <section className="mt-12"><div><p className="eyebrow">Có thể bạn quan tâm</p><h2 className="mt-2 text-2xl font-black tracking-[-0.025em]">Sản phẩm cùng danh mục</h2></div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{relatedProducts.map((related, index) => <RelatedProductCard key={related.id} product={related} index={index} />)}</div></section>
      ) : null}
    </AppShell>
  );
}

function ProductLoading() {
  return <AppShell><div className="grid min-h-[60vh] place-items-center"><div className="text-center"><span className="loading-spinner mx-auto" /><p className="mt-3 text-sm text-[var(--muted)]">Đang tải chi tiết sản phẩm…</p></div></div></AppShell>;
}

function Stars({ rating }: { rating: number }) {
  return <span className="inline-flex gap-0.5 text-amber-500" aria-label={`${rating.toFixed(1)} trên 5 sao`}>{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={16} fill={value <= Math.round(rating) ? 'currentColor' : 'none'} />)}</span>;
}

function Assurance({ icon: Icon, label }: { icon: typeof ShieldCheck; label: string }) {
  return <div className="rounded-xl border border-[var(--line)] bg-white p-3 text-center"><Icon className="mx-auto text-[var(--accent)]" size={18} /><p className="mt-2 text-[10px] font-bold leading-4 text-[var(--muted)]">{label}</p></div>;
}

function ReviewCard({ review }: { review: Review }) {
  const initials = review.user.fullName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
  return <div className="border-t border-[var(--line)] pt-4 first:border-t-0 first:pt-0"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-xs font-black text-[var(--accent-strong)]">{initials || 'U'}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-extrabold">{review.user.fullName}</p><Stars rating={review.rating} /></div><time className="text-xs text-[var(--muted)]">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</time></div><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{review.comment || 'Khách hàng đã đánh giá sản phẩm nhưng không để lại nhận xét.'}</p></div></div></div>;
}

function RelatedProductCard({ product, index }: { product: RelatedProduct; index: number }) {
  const gradients = ['from-[#d9eee5] to-[#f1d4ad]', 'from-[#e3e6f6] to-[#c8d8ea]', 'from-[#f5dfd2] to-[#d9e9df]', 'from-[#dceada] to-[#ead8e9]'];
  const image = product.images?.[0];
  return <Link href={productDetailPath(product.slug)} className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"><div className={`relative aspect-[4/3] bg-gradient-to-br ${gradients[index % gradients.length]} bg-cover bg-center`} style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined}>{!image ? <span className="absolute inset-0 grid place-items-center text-[#244b40]/20"><PackageSearch size={48} /></span> : null}</div><div className="p-4"><p className="truncate text-xs font-semibold text-[var(--muted)]">{product.shop.name}</p><h3 className="mt-2 line-clamp-2 min-h-12 font-extrabold leading-6">{product.name}</h3><p className="mt-3 font-black text-[var(--accent-strong)]">{formatVnd(product.price)}</p></div></Link>;
}
