import { PackagePlus, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '@/components/AppShell';

const rows = [
  { name: 'Everyday Cotton Shirt', status: 'ACTIVE', stock: 42, price: '329.000 VND' },
  { name: 'Travel Tech Pouch', status: 'DRAFT', stock: 23, price: '420.000 VND' },
  { name: 'Modular Desk Lamp', status: 'ACTIVE', stock: 18, price: '590.000 VND' },
];

export default function VendorProductsPage() {
  return (
    <AppShell>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Vendor products</h1>
        <button className="flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white">
          <PackagePlus size={17} />
          Add product
        </button>
      </div>
      <div className="overflow-hidden rounded-md border border-[var(--line)] bg-white">
        <div className="grid grid-cols-[1fr_120px_120px_140px] border-b border-[var(--line)] bg-[#f0f0ea] p-3 text-sm font-medium">
          <span>Product</span>
          <span>Status</span>
          <span>Stock</span>
          <span>Price</span>
        </div>
        {rows.map((row) => (
          <div key={row.name} className="grid grid-cols-[1fr_120px_120px_140px] items-center border-b border-[var(--line)] p-3 text-sm last:border-b-0">
            <span className="font-medium">{row.name}</span>
            <span>{row.status}</span>
            <span>{row.stock}</span>
            <span className="flex items-center justify-between">
              {row.price}
              <button className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--line)]" aria-label="Product settings">
                <SlidersHorizontal size={15} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
