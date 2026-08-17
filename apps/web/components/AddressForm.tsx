'use client';

import { MapPin, Save } from 'lucide-react';
import { FormEvent, useCallback, useState } from 'react';
import { AddressMapPicker } from '@/components/AddressMapPicker';
import { EMPTY_ADDRESS, mergeLocatedAddress, type AddressDraft } from '@/lib/address';

const FIELDS: Array<{
  key: keyof AddressDraft;
  label: string;
  placeholder: string;
  autoComplete: string;
}> = [
  { key: 'recipient', label: 'Người nhận', placeholder: 'Nhập họ và tên người nhận', autoComplete: 'name' },
  { key: 'phone', label: 'Số điện thoại', placeholder: 'Ví dụ: 0912 345 678', autoComplete: 'tel' },
  { key: 'line1', label: 'Số nhà, tên đường', placeholder: 'Ví dụ: 123 Nguyễn Văn Cừ', autoComplete: 'address-line1' },
  { key: 'ward', label: 'Phường / Xã', placeholder: 'Nhập phường hoặc xã', autoComplete: 'address-level3' },
  { key: 'district', label: 'Quận / Huyện', placeholder: 'Nhập quận hoặc huyện', autoComplete: 'address-level2' },
  { key: 'city', label: 'Tỉnh / Thành phố', placeholder: 'Nhập tỉnh hoặc thành phố', autoComplete: 'address-level1' },
];

export function AddressForm({
  onSubmit,
  submitLabel = 'Lưu địa chỉ',
  initialValue = EMPTY_ADDRESS,
}: {
  onSubmit: (address: AddressDraft) => Promise<void>;
  submitLabel?: string;
  initialValue?: AddressDraft;
}) {
  const [address, setAddress] = useState<AddressDraft>(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const applyLocatedAddress = useCallback((located: Partial<AddressDraft>) => {
    setAddress((current) => mergeLocatedAddress(current, located));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(address);
      setAddress(EMPTY_ADDRESS);
    } catch {
      // The parent owns and presents the API error message.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <AddressMapPicker onAddress={applyLocatedAddress} />
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className={`grid gap-1.5 text-sm ${field.key === 'line1' ? 'sm:col-span-2' : ''}`}>
            <span className="font-semibold">{field.label}</span>
            <input
              name={field.key}
              className="h-11 rounded-xl border border-[var(--line)] px-3.5"
              value={address[field.key]}
              onChange={(event) => setAddress((current) => ({ ...current, [field.key]: event.target.value }))}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              required
            />
          </label>
        ))}
      </div>
      <button className="button-primary w-full" disabled={submitting}>
        {submitting ? 'Đang lưu…' : <><Save size={17} /> {submitLabel}</>}
      </button>
      <p className="flex items-start gap-1.5 text-xs leading-5 text-[var(--muted)]"><MapPin size={14} className="mt-0.5 shrink-0" /> Địa chỉ trên bản đồ chỉ hỗ trợ điền nhanh. Địa chỉ trong các ô phía trên là thông tin sẽ được lưu.</p>
    </form>
  );
}
