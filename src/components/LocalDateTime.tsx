"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";

function formatLocal(date: Date) {
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  const zone = new Intl.DateTimeFormat("id-ID", {
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return `${datePart}, ${timePart}${zone ? ` ${zone}` : ""}`.toUpperCase();
}

/** Jam live berdasarkan perangkat/browser pengguna, bukan waktu server Vercel. */
export function LocalDateTime() {
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    const update = () => setValue(formatLocal(new Date()));
    update();
    const timer = window.setInterval(update, 1_000);
    const refresh = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return (
    <span className="flex items-center gap-2" suppressHydrationWarning>
      <CalendarClock size={14} />
      <span>{value || "MEMBACA WAKTU PERANGKAT…"}</span>
    </span>
  );
}
