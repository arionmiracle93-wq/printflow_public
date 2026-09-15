"use client";

import { Camera, ClipboardList, Factory, MessageCircle, MoreHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

type TabKey = "ringkasan" | "mitra" | "komunikasi" | "foto" | "lainnya";

export function OrderDetailTabs({
  ringkasan,
  mitra,
  komunikasi,
  foto,
  lainnya,
  mitraActive,
  komunikasiPending,
}: {
  ringkasan: ReactNode;
  mitra: ReactNode;
  komunikasi: ReactNode;
  foto: ReactNode;
  lainnya: ReactNode;
  /** Ada produksi mitra yang masih berjalan (belum "Diterima"). */
  mitraActive: boolean;
  /** Ada serah terima yang belum diterima operator tujuan. */
  komunikasiPending: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("ringkasan");

  const tabs: { key: TabKey; label: string; icon: ReactNode; indicator?: ReactNode }[] = [
    { key: "ringkasan", label: "Ringkasan", icon: <ClipboardList size={17} /> },
    {
      key: "mitra",
      label: "Mitra",
      icon: <Factory size={17} />,
      indicator: mitraActive ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" aria-label="Ada produksi mitra berjalan" />
      ) : undefined,
    },
    {
      key: "komunikasi",
      label: "Komunikasi",
      icon: <MessageCircle size={17} />,
      indicator: komunikasiPending ? (
        <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white" aria-label="Ada serah terima menunggu">
          !
        </span>
      ) : undefined,
    },
    { key: "foto", label: "Foto", icon: <Camera size={17} /> },
    { key: "lainnya", label: "Lainnya", icon: <MoreHorizontal size={17} /> },
  ];

  return (
    <div>
      <div className="sticky top-[60px] z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-white/10 dark:bg-[#081420]/95 md:sticky md:top-16 md:z-20 md:mx-0 md:rounded-t-2xl md:border-x md:border-t">
        <div className="grid grid-cols-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative flex flex-col items-center gap-1 border-b-2 px-1 py-2.5 text-[10.5px] font-bold transition ${
                tab === t.key
                  ? "border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300"
                  : "border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              }`}
            >
              <span className="relative">
                {t.icon}
                {t.indicator}
              </span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 py-4 md:rounded-b-2xl md:border-x md:border-b md:border-slate-200 md:px-4 md:dark:border-white/10">
        {tab === "ringkasan" ? ringkasan : null}
        {tab === "mitra" ? mitra : null}
        {tab === "komunikasi" ? komunikasi : null}
        {tab === "foto" ? foto : null}
        {tab === "lainnya" ? lainnya : null}
      </div>
    </div>
  );
}
