'use client';

import { AppShell } from '@/components/AppShell';
import { apiRequest } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';

type Category = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  parent: { id: number; name: string } | null;
  _count: { children: number; products: number };
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setCategories(await apiRequest<Category[]>('/admin/categories', {}, true));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiRequest('/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          slug: form.get('slug'),
          parentId: form.get('parentId') ? Number(form.get('parentId')) : undefined,
        }),
      }, true);
      event.currentTarget.reset();
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create category');
    }
  }

  async function toggle(category: Category) {
    try {
      await apiRequest(`/categories/${category.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !category.isActive }),
      }, true);
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update category');
    }
  }

  return (
    <AppShell>
      <h1 className="text-2xl font-semibold">Category governance</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">Manage hierarchy and activation without orphaning active products.</p>

      <form className="mt-4 grid gap-3 rounded-md border border-[var(--line)] bg-white p-4 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={create}>
        <input name="name" className="h-10 rounded border border-[var(--line)] px-3" placeholder="Category name" required />
        <input name="slug" className="h-10 rounded border border-[var(--line)] px-3" placeholder="category-slug" required />
        <select name="parentId" className="h-10 rounded border border-[var(--line)] px-3">
          <option value="">Root category</option>
          {categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <button className="h-10 rounded bg-[var(--accent)] px-4 text-white">Create</button>
      </form>

      {loading ? <p className="mt-4">Loading categories…</p> : null}
      {error ? <p className="mt-4 rounded bg-red-50 p-3 text-red-700">{error}</p> : null}
      <div className="mt-4 overflow-x-auto rounded-md border border-[var(--line)] bg-white">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[1fr_1fr_100px_150px_120px] bg-[#f0f0ea] p-3 text-sm font-medium">
            <span>Name</span><span>Parent</span><span>Status</span><span>Dependencies</span><span>Action</span>
          </div>
          {categories.map((category) => (
            <div key={category.id} className="grid grid-cols-[1fr_1fr_100px_150px_120px] border-t border-[var(--line)] p-3 text-sm">
              <span className="font-medium">{category.name}</span>
              <span>{category.parent?.name ?? 'Root'}</span>
              <span>{category.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
              <span>{category._count.children} children · {category._count.products} products</span>
              <button className="w-fit rounded border border-[var(--line)] px-2 py-1" onClick={() => void toggle(category)}>
                {category.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
