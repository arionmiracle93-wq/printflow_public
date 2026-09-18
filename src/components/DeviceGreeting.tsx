"use client";

import { useEffect, useState } from "react";

type Greeting = { word: string; emoji: string };

/** Sapaan mengikuti JAM PERANGKAT pengguna (bukan jam server Vercel), konsisten
 *  dengan komponen LocalDateTime yang dipakai di aplikasi ini. */
function greetingFor(hour: number): Greeting {
  if (hour >= 4 && hour < 11) return { word: "pagi", emoji: "🌄" };
  if (hour >= 11 && hour < 15) return { word: "siang", emoji: "☀️" };
  if (hour >= 15 && hour < 19) return { word: "sore", emoji: "🌇" };
  return { word: "malam", emoji: "🌙" };
}

export function DeviceGreeting({ name, className = "" }: { name: string; className?: string }) {
  const [greeting, setGreeting] = useState<Greeting | null>(null);

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours()));
  }, []);

  const word = greeting?.word ?? "datang";
  const emoji = greeting?.emoji ?? "👋";

  return (
    <span className={className} suppressHydrationWarning>
      Selamat {word}, <span className="text-amber-300">{name}</span>{" "}
      <span aria-hidden="true">{emoji}</span>
    </span>
  );
}
