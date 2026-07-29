'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest, formatVnd } from '@/lib/api';
import { Archive, PackagePlus, Pencil, RefreshCw } from 'lucide-react';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Shop = { id: string; name: string; status: string };
type Category = { id: number; name: string; children: Category[] };
type Product = {
  id: string;
  name: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  price: string;
  inventory: { onHand: number; reserved: number };
};

export default function VendorProductsPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState('');
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
      setProducts(
        activeShop ? await apiRequest<Product[]>(`/shops/${activeShop.id}/products`, {}, true) : [],
      );
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load vendor products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function setStatus(product: Product, status: 'DRAFT' | 'ACTIVE') {
    try {
      await apiRequest(`/products/${product.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update product');
    }
  }

  async function archive(product: Product) {
    try {
      await apiRequest(`/products/${product.id}/archive`, { method: 'PATCH' }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to archive product');
    }
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vendor products</h1>
          <p className="text-sm text-[var(--muted)]">{shop ? `${shop.name} · ${shop.status}` : 'No shop selected'}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex h-10 items-center gap-2 rounded-md border border-[var(--line)] px-3" onClick={() => void load()}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white" onClick={() => setShowCreate((value) => !value)} disabled={!shop}>
            <PackagePlus size={17} /> Add product
          </button>
        </div>
      </div>

      {showCreate && shop ? (
        <CreateProductForm shopId={shop.id} categories={categories} onCreated={async () => { setShowCreate(false); await load(); }} />
      ) : null}
      {editing ? <EditProductForm product={editing} onSaved={async () => { setEditing(null); await load(); }} /> : null}
      {loading ? <p className="rounded-md border border-[var(--line)] bg-white p-4">Loading products…</p> : null}
      {error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && !error && !shop ? <p className="rounded-md border border-[var(--line)] bg-white p-4">Create a shop before managing products.</p> : null}

      {shop ? (
        <div className="overflow-x-auto rounded-md border border-[var(--line)] bg-white">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1fr_120px_120px_140px_180px] border-b border-[var(--line)] bg-[#f0f0ea] p-3 text-sm font-medium">
              <span>Product</span><span>Status</span><span>Available</span><span>Price</span><span>Actions</span>
            </div>
            {products.map((product) => (
              <div key={product.id} className="grid grid-cols-[1fr_120px_120px_140px_180px] items-center border-b border-[var(--line)] p-3 text-sm last:border-b-0">
                <span className="font-medium">{product.name}</span>
                <span>{product.status}</span>
                <span>{product.inventory.onHand - product.inventory.reserved}</span>
                <span>{formatVnd(product.price)}</span>
                <span className="flex gap-2">
                  {product.status !== 'ARCHIVED' ? (
                    <>
                      <button className="rounded border border-[var(--line)] p-1" aria-label="Edit product" onClick={() => setEditing(product)}>
                        <Pencil size={16} />
                      </button>
                      <button className="rounded border border-[var(--line)] px-2 py-1" onClick={() => void setStatus(product, product.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE')}>
                        {product.status === 'ACTIVE' ? 'Draft' : 'Activate'}
                      </button>
                      <button className="rounded border border-red-200 p-1 text-red-700" aria-label="Archive product" onClick={() => void archive(product)}>
                        <Archive size={16} />
                      </button>
                    </>
                  ) : null}
                </span>
              </div>
            ))}
            {!loading && products.length === 0 ? <p className="p-4 text-sm text-[var(--muted)]">No products yet.</p> : null}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function EditProductForm({ product, onSaved }: { product: Product; onSaved: () => Promise<void> }) {
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/products/${product.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.get('name'),
          price: Number(form.get('price')),
        }),
      }, true);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mb-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={submit}>
      <input name="name" className="h-10 rounded border border-[var(--line)] px-3" defaultValue={product.name} required minLength={3} />
      <input name="price" className="h-10 rounded border border-[var(--line)] px-3" type="number" min="0" defaultValue={product.price} required />
      <button className="h-10 rounded bg-[var(--accent)] px-4 text-white disabled:opacity-60" disabled={submitting}>
        {submitting ? 'Saving…' : 'Save product'}
      </button>
      {error ? <p className="text-sm text-red-700 md:col-span-3">{error}</p> : null}
    </form>
  );
}

function CreateProductForm({ shopId, categories, onCreated }: { shopId: string; categories: Category[]; onCreated: () => Promise<void> }) {
  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/shops/${shopId}/products`, {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          categoryId: Number(form.get('categoryId')),
          price: Number(form.get('price')),
          initialStock: Number(form.get('initialStock')),
          status: 'DRAFT',
        }),
      }, true);
      await onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mb-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-2" onSubmit={submit}>
      <input name="name" className="h-10 rounded border border-[var(--line)] px-3" placeholder="Product name" required minLength={3} />
      <input name="slug" className="h-10 rounded border border-[var(--line)] px-3" placeholder="product-slug" required minLength={3} />
      <select name="categoryId" className="h-10 rounded border border-[var(--line)] px-3" required>
        <option value="">Select category</option>
        {flatCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      <input name="price" className="h-10 rounded border border-[var(--line)] px-3" type="number" min="0" placeholder="Price" required />
      <input name="initialStock" className="h-10 rounded border border-[var(--line)] px-3" type="number" min="0" placeholder="Initial stock" required />
      <button className="h-10 rounded bg-[var(--accent)] px-4 text-white disabled:opacity-60" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create draft product'}
      </button>
      {error ? <p className="text-sm text-red-700 md:col-span-2">{error}</p> : null}
    </form>
  );
}
