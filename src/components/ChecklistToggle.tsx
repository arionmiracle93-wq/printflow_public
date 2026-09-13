"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Tombol centang untuk langkah yang harus dijawab sendiri oleh pemilik (mis. "sudah dipasang di HP?"). */
export function ChecklistToggle({
  settingKey,
  done,
  labelOn = "Tandai sudah selesai",
  labelOff = "Tandai belum selesai",
}: {
  settingKey: string;
  done: boolean;
  labelOn?: string;
  labelOff?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(done);
  const [pending, startTransition] = useTransition();

  async function toggle() {
    const next = !value;
    setValue(next);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: next ? "1" : "0" }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={value ? "btn-ghost border-emerald-300 bg-emerald-50 text-emerald-700" : "btn-primary"}
    >
      {value ? `✅ ${labelOff}` : `☐ ${labelOn}`}
    </button>
  );
}
