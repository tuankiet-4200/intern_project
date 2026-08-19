'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import {
  attributeRowsFromProduct,
  moveProductImageUrl,
  normalizeProductImageUrls,
  serializeProductAttributes,
  type ProductAttributeRow,
} from '@/lib/vendor-product-form';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ImagePlus,
  PackagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Shop = { id: string; name: string; status: string };
type Category = { id: number; name: string; children: Category[] };
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  price: string;
  compareAtPrice: string | null;
  images: string[];
  attributes: unknown;
  categoryId: number;
  category: { id: number; name: string };
  inventory: { onHand: number; reserved: number };
};

export default function VendorProductsPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [shops, categoryTree] = await Promise.all([
        apiRequest<Shop[]>('/shops/me', {}, true),
        apiRequest<Category[]>('/categories'),
      ]);
      const activeShop = shops[0] ?? null;
      setShop(activeShop);
      setCategories(categoryTree);
      setProducts(activeShop ? await apiRequest<Product[]>(`/shops/${activeShop.id}/products`, {}, true) : []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể tải danh sách sản phẩm.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(product: Product, status: 'DRAFT' | 'ACTIVE') {
    setError('');
    setNotice('');
    try {
      await apiRequest(`/products/${product.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }, true);
      setNotice(`Đã chuyển “${product.name}” sang ${status}.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể cập nhật trạng thái sản phẩm.');
    }
  }

  async function archive(product: Product) {
    setError('');
    setNotice('');
    try {
      await apiRequest(`/products/${product.id}/archive`, { method: 'PATCH' }, true);
      setNotice(`Đã lưu trữ “${product.name}”.`);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu trữ sản phẩm.');
    }
  }

  async function finishEditor(message: string) {
    setShowCreate(false);
    setEditing(null);
    setNotice(message);
    await load();
  }

  return (
    <AppShell>
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">Catalog operations</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.035em]">Quản lý sản phẩm</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{shop ? `${shop.name} · ${shop.status}` : 'Chưa có cửa hàng được chọn'}</p>
        </div>
        <div className="flex gap-2">
          <button className="button-ghost" onClick={() => void load()}><RefreshCw size={16} /> Làm mới</button>
          <button
            className="button-primary"
            onClick={() => { setEditing(null); setShowCreate(true); setNotice(''); }}
            disabled={!shop}
          >
            <PackagePlus size={17} /> Thêm sản phẩm
          </button>
        </div>
      </header>

      {notice ? <div className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-100 px-4 py-3 text-sm text-emerald-900"><Check size={17} /> {notice}</div> : null}
      {error ? <div className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {showCreate && shop ? (
        <ProductEditor
          key="create-product"
          mode="create"
          shopId={shop.id}
          categories={categories}
          onCancel={() => setShowCreate(false)}
          onSaved={() => finishEditor('Đã tạo sản phẩm nháp mới.')}
        />
      ) : null}
      {editing && shop ? (
        <ProductEditor
          key={editing.id}
          mode="edit"
          shopId={shop.id}
          product={editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSaved={() => finishEditor(`Đã cập nhật “${editing.name}”.`)}
        />
      ) : null}

      {loading ? <div className="mt-6 grid min-h-52 place-items-center rounded-2xl border border-[var(--line)] bg-white"><div className="text-center"><span className="loading-spinner mx-auto" /><p className="mt-3 text-sm text-[var(--muted)]">Đang tải sản phẩm…</p></div></div> : null}
      {!loading && !shop ? <div className="surface-card mt-6 p-8 text-center"><PackagePlus className="mx-auto text-[var(--accent)]" size={30} /><h2 className="mt-3 font-extrabold">Hãy tạo cửa hàng trước</h2><p className="mt-1 text-sm text-[var(--muted)]">Bạn cần một cửa hàng để bắt đầu quản lý catalog.</p></div> : null}

      {!loading && shop ? (
        <section className="surface-card mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><div><h2 className="font-extrabold">Catalog của cửa hàng</h2><p className="mt-0.5 text-xs text-[var(--muted)]">{products.length} sản phẩm</p></div><span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">{shop.status}</span></div>
          {products.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-[minmax(280px,1.5fr)_130px_110px_150px_210px] border-b border-[var(--line)] bg-[#f5f8f6] px-5 py-3 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--muted)]"><span>Sản phẩm</span><span>Trạng thái</span><span>Khả dụng</span><span>Giá bán</span><span>Thao tác</span></div>
                {products.map((product) => <ProductRow key={product.id} product={product} onEdit={() => { setShowCreate(false); setEditing(product); setNotice(''); }} onStatus={(status) => void setStatus(product, status)} onArchive={() => void archive(product)} />)}
              </div>
            </div>
          ) : <div className="p-10 text-center"><PackagePlus className="mx-auto text-[var(--muted)]" size={30} /><h3 className="mt-3 font-extrabold">Chưa có sản phẩm</h3><p className="mt-1 text-sm text-[var(--muted)]">Tạo draft đầu tiên, bổ sung nội dung và kích hoạt khi sẵn sàng.</p></div>}
        </section>
      ) : null}
    </AppShell>
  );
}

function ProductRow({ product, onEdit, onStatus, onArchive }: { product: Product; onEdit: () => void; onStatus: (status: 'DRAFT' | 'ACTIVE') => void; onArchive: () => void }) {
  const available = Math.max(0, product.inventory.onHand - product.inventory.reserved);
  const image = product.images[0];
  const statusTone = product.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : product.status === 'ARCHIVED' ? 'bg-gray-200 text-gray-600' : 'bg-amber-100 text-amber-800';
  return (
    <div className="grid grid-cols-[minmax(280px,1.5fr)_130px_110px_150px_210px] items-center border-b border-[var(--line)] px-5 py-4 text-sm last:border-b-0">
      <div className="flex min-w-0 items-center gap-3"><div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-[#d9eee5] to-[#efd8bc] bg-cover bg-center" style={image ? { backgroundImage: `url(${JSON.stringify(image)})` } : undefined} /> <div className="min-w-0"><p className="truncate font-extrabold">{product.name}</p><p className="mt-0.5 truncate text-xs text-[var(--muted)]">{product.category.name} · /{product.slug}</p></div></div>
      <span><span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${statusTone}`}>{product.status}</span></span>
      <span className="font-bold">{available}</span>
      <span><strong className="block text-[var(--accent-strong)]">{formatVnd(product.price)}</strong>{product.compareAtPrice ? <span className="text-xs text-[var(--muted)] line-through">{formatVnd(product.compareAtPrice)}</span> : null}</span>
      <span className="flex items-center gap-2">
        {product.status !== 'ARCHIVED' ? <><button className="icon-button !h-9 !w-9" aria-label="Sửa sản phẩm" onClick={onEdit}><Pencil size={16} /></button><button className="button-soft !min-h-9 !px-3 !py-1 text-xs" onClick={() => onStatus(product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE')}>{product.status === 'ACTIVE' ? 'Ẩn bán' : 'Kích hoạt'}</button><button className="icon-button !h-9 !w-9 !border-red-200 !text-red-700" aria-label="Lưu trữ sản phẩm" onClick={onArchive}><Archive size={16} /></button></> : <span className="text-xs text-[var(--muted)]">Không thể chỉnh sửa</span>}
      </span>
    </div>
  );
}

function ProductEditor({ mode, shopId, product, categories, onCancel, onSaved }: { mode: 'create' | 'edit'; shopId: string; product?: Product; categories: Category[]; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [imageUrls, setImageUrls] = useState<string[]>(product?.images.length ? product.images : ['']);
  const [attributeRows, setAttributeRows] = useState<ProductAttributeRow[]>(() => {
    const rows = attributeRowsFromProduct(product?.attributes);
    return rows.length ? rows : [{ key: '', value: '' }];
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const price = Number(form.get('price'));
      const compareAtRaw = String(form.get('compareAtPrice') ?? '').trim();
      const compareAtPrice = compareAtRaw ? Number(compareAtRaw) : null;
      if (compareAtPrice !== null && compareAtPrice <= price) throw new Error('Giá gốc phải lớn hơn giá bán.');
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        categoryId: Number(form.get('categoryId')),
        price,
        compareAtPrice: mode === 'create' && compareAtPrice === null ? undefined : compareAtPrice,
        description: String(form.get('description') ?? '').trim(),
        images: normalizeProductImageUrls(imageUrls),
        attributes: serializeProductAttributes(attributeRows),
        ...(mode === 'create'
          ? { initialStock: Number(form.get('initialStock')), status: 'DRAFT' }
          : { stockOnHand: Number(form.get('stockOnHand')) }),
      };
      await apiRequest(mode === 'create' ? `/shops/${shopId}/products` : `/products/${product!.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body: JSON.stringify(payload),
      }, true);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể lưu sản phẩm.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="surface-card mt-6 overflow-hidden" onSubmit={submit}>
      <header className="flex items-center justify-between border-b border-[var(--line)] bg-[#f7faf8] px-5 py-4 sm:px-7"><div><p className="eyebrow">{mode === 'create' ? 'New product' : 'Edit product'}</p><h2 className="mt-1 text-xl font-black">{mode === 'create' ? 'Tạo sản phẩm nháp' : `Chỉnh sửa ${product?.name}`}</h2></div><button type="button" className="icon-button" onClick={onCancel} aria-label="Đóng form"><X size={18} /></button></header>
      <div className="grid gap-7 p-5 sm:p-7 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="grid content-start gap-6">
          <FormSection title="Thông tin cơ bản" description="Tên, đường dẫn, danh mục và nội dung khách hàng sẽ đọc.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên sản phẩm"><input name="name" className="h-11 rounded-xl border px-3" value={name} onChange={(event) => setName(event.target.value)} required minLength={3} maxLength={140} /></Field>
              <Field label="Slug"><input name="slug" className="h-11 rounded-xl border px-3" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="ten-san-pham" required minLength={3} maxLength={160} /></Field>
              <Field label="Danh mục"><select name="categoryId" className="h-11 rounded-xl border px-3" defaultValue={product?.categoryId ?? ''} required><option value="">Chọn danh mục</option>{flatCategories.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}</select></Field>
              {mode === 'create' ? (
                <Field label="Tồn kho ban đầu" hint="Hệ thống tự ghi nhận bút toán tồn kho khởi tạo.">
                  <input name="initialStock" className="h-11 rounded-xl border px-3" type="number" min="0" step="1" defaultValue="0" required />
                </Field>
              ) : (
                <Field label="Tồn kho thực tế" hint={`Đang giữ ${product?.inventory.reserved ?? 0} sản phẩm cho đơn hàng; không thể đặt thấp hơn mức này.`}>
                  <input name="stockOnHand" className="h-11 rounded-xl border px-3" type="number" min={product?.inventory.reserved ?? 0} step="1" defaultValue={product?.inventory.onHand ?? 0} required />
                </Field>
              )}
            </div>
            <Field label="Mô tả sản phẩm" hint="Tối đa 5.000 ký tự."><textarea name="description" className="min-h-36 rounded-xl border p-3" defaultValue={product?.description ?? ''} maxLength={5000} placeholder="Mô tả công dụng, chất liệu, hướng dẫn sử dụng…" /></Field>
          </FormSection>

          <FormSection title="Giá bán" description="Giá gốc là tùy chọn và phải lớn hơn giá bán.">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Giá bán (VND)"><input name="price" className="h-11 rounded-xl border px-3" type="number" min="0" step="1" defaultValue={product?.price ?? ''} required /></Field><Field label="Giá gốc (VND)" hint="Để trống nếu không giảm giá."><input name="compareAtPrice" className="h-11 rounded-xl border px-3" type="number" min="0" step="1" defaultValue={product?.compareAtPrice ?? ''} /></Field></div>
          </FormSection>

          <FormSection title="Thuộc tính" description="Ví dụ: Màu sắc, chất liệu, kích thước. Tối đa 20 thuộc tính.">
            <div className="grid gap-2">{attributeRows.map((row, index) => <div key={index} className="grid grid-cols-[1fr_1fr_40px] gap-2"><input className="h-10 rounded-xl border px-3 text-sm" value={row.key} onChange={(event) => updateAttributeRow(setAttributeRows, index, 'key', event.target.value)} placeholder="Tên thuộc tính" maxLength={60} /><input className="h-10 rounded-xl border px-3 text-sm" value={row.value} onChange={(event) => updateAttributeRow(setAttributeRows, index, 'value', event.target.value)} placeholder="Giá trị" maxLength={300} /><button type="button" className="icon-button !h-10 !w-10" onClick={() => setAttributeRows((rows) => rows.filter((_, rowIndex) => rowIndex !== index))} aria-label="Xóa thuộc tính"><Trash2 size={15} /></button></div>)}</div>
            <button type="button" className="button-ghost mt-3 !min-h-9 !px-3 !py-1 text-xs" disabled={attributeRows.length >= 20} onClick={() => setAttributeRows((rows) => [...rows, { key: '', value: '' }])}><Plus size={14} /> Thêm thuộc tính</button>
          </FormSection>
        </div>

        <FormSection title="Hình ảnh sản phẩm" description="Thêm tối đa 8 URL ảnh HTTP/HTTPS. Ảnh đầu tiên là ảnh đại diện.">
          <div className="grid gap-3">{imageUrls.map((url, index) => <div key={index} className="rounded-2xl border border-[var(--line)] p-3"><div className="flex gap-3"><div className="h-20 w-20 shrink-0 rounded-xl bg-gradient-to-br from-[#d9eee5] to-[#efd8bc] bg-cover bg-center" style={imageBackground(url)}>{!imageBackground(url) ? <span className="grid h-full place-items-center text-[var(--muted)]"><ImagePlus size={21} /></span> : null}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><label className="text-xs font-extrabold">Ảnh {index + 1}{index === 0 ? ' · Ảnh đại diện' : ''}</label><span className="flex items-center gap-2"><button type="button" className="text-[var(--muted)] disabled:opacity-30" disabled={index === 0} onClick={() => setImageUrls((urls) => moveProductImageUrl(urls, index, -1))} aria-label="Đưa ảnh lên"><ArrowUp size={15} /></button><button type="button" className="text-[var(--muted)] disabled:opacity-30" disabled={index === imageUrls.length - 1} onClick={() => setImageUrls((urls) => moveProductImageUrl(urls, index, 1))} aria-label="Đưa ảnh xuống"><ArrowDown size={15} /></button><button type="button" className="text-red-600" onClick={() => setImageUrls((urls) => urls.filter((_, imageIndex) => imageIndex !== index))} aria-label="Xóa ảnh"><Trash2 size={16} /></button></span></div><input type="url" className="mt-2 h-10 w-full rounded-xl border px-3 text-sm" value={url} onChange={(event) => setImageUrls((urls) => urls.map((value, imageIndex) => imageIndex === index ? event.target.value : value))} placeholder="https://example.com/product.jpg" maxLength={2048} /></div></div></div>)}</div>
          {imageUrls.length < 8 ? <button type="button" className="button-soft mt-3 w-full" onClick={() => setImageUrls((urls) => [...urls, ''])}><ImagePlus size={16} /> Thêm URL ảnh</button> : null}
          <div className="mt-5 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900">Hiện hệ thống lưu URL ảnh. Upload file trực tiếp cần object storage/CDN và signed-upload flow riêng; không lưu file base64 vào database.</div>
        </FormSection>
      </div>
      {error ? <p className="mx-5 mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:mx-7">{error}</p> : null}
      <footer className="flex flex-col-reverse gap-2 border-t border-[var(--line)] bg-[#f7faf8] px-5 py-4 sm:flex-row sm:justify-end sm:px-7"><button type="button" className="button-ghost" onClick={onCancel}>Hủy</button><button className="button-primary min-w-40" disabled={submitting}>{submitting ? <><span className="loading-spinner !h-5 !w-5 !border-2 !border-white/40 !border-t-white" /> Đang lưu…</> : <><Save size={17} /> {mode === 'create' ? 'Tạo sản phẩm' : 'Lưu thay đổi'}</>}</button></footer>
    </form>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-xs leading-5 text-[var(--muted)]">{description}</p><div className="mt-4 grid gap-4">{children}</div></section>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="grid content-start gap-2 text-sm font-bold">{label}{children}{hint ? <span className="text-xs font-normal leading-5 text-[var(--muted)]">{hint}</span> : null}</label>;
}

function flattenCategories(categories: Category[], depth = 0): Array<{ id: number; label: string }> {
  return categories.flatMap((category) => [{ id: category.id, label: `${'— '.repeat(depth)}${category.name}` }, ...flattenCategories(category.children ?? [], depth + 1)]);
}

function updateAttributeRow(setRows: React.Dispatch<React.SetStateAction<ProductAttributeRow[]>>, index: number, field: keyof ProductAttributeRow, value: string) {
  setRows((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
}

function imageBackground(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return { backgroundImage: `url(${JSON.stringify(value)})` };
  } catch {
    return undefined;
  }
}
