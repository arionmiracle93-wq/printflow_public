"use client";

import { useState } from "react";
import { DateFieldID } from "@/components/DateFieldID";

/**
 * ISIAN TANGGAL UNTUK FORM GET
 *
 * DateFieldID bekerja dengan kendali: nilainya datang dari parent lewat
 * prop `value` dan setiap perubahan diteruskan lewat `onChange`. Itu
 * benar untuk form editor invoice, karena isian di situ ikut ikut
 * terhitung ulang (tanggal issues, jatuh tempo, total).
 *
 * Isian di halaman laporan berbeda: mereka milik form GET biasa yang
 * punya `defaultValue` dan tidak butuh nilai balik ke server render.
 * Menjadikan isian ini kendali akan memaksa halaman laporan menjadi client
 * component yang menyimpan keadaan form - padahal sebelumnya hanya satu
 * baris HTML.
 *
 * Jadi ini pembungkus 10 baris: memegang state sendiri, lalu
 * meneruskannya ke DateFieldID yang sudah menangani dd/mm/yyyy dan
 * kalendernya. Input tersembunyi bernama dipegang DateFieldID lewat
 * prop `name`, jadi form GET tetap mengirim "yyyy-mm-dd" seperti
 * sebelumnya.
 */
export function DateInputForm({
  name,
  defaultValue,
  className = "",
  min,
  maks,
}: {
  name: string;
  defaultValue?: string; // "yyyy-mm-dd" atau ""
  className?: string;
  min?: string;
  maks?: string;
}) {
  const [nilai, setNilai] = useState(defaultValue ?? "");
  return <DateFieldID name={name} value={nilai} onChange={setNilai} className={className} min={min} maks={maks} />;
}
