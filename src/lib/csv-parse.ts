/** Pembaca CSV sederhana (diporting dari app lama): pemisah titik koma atau koma, kutip ganda, BOM. Kode murni. */
export function detectCsvDelimiter(text: string): ";" | "," {
  const first = String(text).split(/\r?\n/).find((l) => l.trim());
  if (!first) return ";";
  const semi = (first.match(/;/g) || []).length;
  const comma = (first.match(/,/g) || []).length;
  return semi >= comma ? ";" : ",";
}

export function parseCsv(text: string, delim: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') inQuotes = false;
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === delim) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type CatalogCsvItem = { name: string; description: string; price: string; tiers: string; category: string };

/** Baca CSV katalog: kolom Nama Produk; Keterangan; Harga; Harga Bertingkat; Kategori. Baris judul dilewati. */
export function catalogFromCsv(raw: string): CatalogCsvItem[] {
  const text = String(raw).replace(/^\uFEFF/, "");
  const rows = parseCsv(text, detectCsvDelimiter(text));
  const items: CatalogCsvItem[] = [];
  rows.forEach((r, idx) => {
    if (idx === 0 && /nama/i.test(String(r[0] || ""))) return;
    const name = String(r[0] || "").trim();
    if (!name) return;
    items.push({
      name,
      description: String(r[1] || "").trim(),
      price: String(r[2] || "").trim(),
      tiers: String(r[3] || "").trim(),
      category: String(r[4] || "").trim(),
    });
  });
  return items;
}

/** Satu sel CSV (kutip bila berisi pemisah/kutip/baris baru). */
export function csvCellText(v: unknown): string {
  const s = String(v ?? "");
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Susun teks CSV: BOM + titik koma + CRLF (dibuka langsung di Excel). */
export function buildCsv(rows: unknown[][]): string {
  return `\uFEFF${rows.map((r) => r.map(csvCellText).join(";")).join("\r\n")}`;
}
