"use client";

import { Select } from "@/components/Select";

export type SavedCustomerOption = {
  id: number;
  name: string;
  phone: string | null;
};

/**
 * Dropdown pelanggan yang sudah tersimpan.
 *
 * Dipakai di semua form yang butuh data customer (invoice, ubah pekerjaan)
 * supaya nama dan nomor WhatsApp bisa diambil dari daftar Pelanggan tanpa
 * mengetik ulang. Form tetap boleh menerima nama baru secara manual.
 */
export function SavedCustomerSelect({
  customers,
  value,
  onChange,
  className = "input",
  placeholder = "Pilih pelanggan tersimpan…",
  ariaLabel = "Ambil dari pelanggan tersimpan",
}: {
  customers: readonly SavedCustomerOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  if (!customers.length) return null;

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={className}
      placeholder={placeholder}
      aria-label={ariaLabel}
    >
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customer.name}
          {customer.phone ? ` · ${customer.phone}` : ""}
        </option>
      ))}
    </Select>
  );
}
