/** 26 produk contoh percetakan (dari app lama). Format harga bertingkat: teks "mode=progresif;basis=m2;6=36000;20=32000". */
export const SAMPLE_CATALOG: { name: string; description: string; price: number; tiers: string; category: string }[] = [
  { name: "Kartu Nama Art Carton 260gr", description: "1 box isi 100 pcs - full color 2 sisi", price: 45000, tiers: "2=42000;5=39000;10=35000", category: "Cetak Kecil" },
  { name: "Brosur A5 Art Paper 150gr", description: "Full color 2 sisi - potong jadi", price: 1500, tiers: "100=1200;500=950;1000=800", category: "Cetak Kecil" },
  { name: "Poster A3 Art Paper 210gr", description: "Full color 1 sisi", price: 7000, tiers: "10=6000;50=5000;100=4200", category: "Cetak Kecil" },
  { name: "Undangan Softcover", description: "Include amplop dan cetak nama tamu", price: 4500, tiers: "50=4000;100=3500;300=3000", category: "Undangan & Buku" },
  { name: "Yasin Hardcover 200 Halaman", description: "Cetak nama + hard cover laminasi", price: 22000, tiers: "50=20000;100=18500;250=17000", category: "Undangan & Buku" },
  { name: "Kalender Dinding 12 Lembar", description: "Art paper 150gr + spiral kawat", price: 28000, tiers: "25=25000;100=22000;500=19500", category: "Cetak Kecil" },
  { name: "ID Card PVC + Tali", description: "Ukuran standar 86x54mm 2 sisi", price: 12000, tiers: "10=10000;50=8500;100=7500", category: "Merchandise" },
  { name: "Amplop Kop Surat", description: "Ukuran 110x230mm - 1 warna", price: 1200, tiers: "250=1000;1000=850", category: "Cetak Kecil" },
  { name: "X-Banner 60x160", description: "Flexi korea + tiang X", price: 75000, tiers: "2=70000;5=65000", category: "Banner & Spanduk" },
  { name: "Roll Up Banner 85x200", description: "Albatros + stand roll up", price: 285000, tiers: "2=270000;5=255000", category: "Banner & Spanduk" },
  { name: "Nota NCR 2 Ply", description: "1 buku 50 set - ukuran 1/3 folio", price: 18000, tiers: "mode=progresif;10=16000;50=14000", category: "Cetak Kecil" },
  { name: "Kaos Sablon DTF Cotton 30s", description: "Sablon DTF - all size", price: 85000, tiers: "mode=progresif;6=78000;24=72000;100=65000", category: "Merchandise" },
  { name: "Mug Custom Keramik", description: "Full color + box mika", price: 35000, tiers: "mode=progresif;12=30000;48=27000", category: "Merchandise" },
  { name: "Pin Peniti 58mm", description: "Full color laminasi doff", price: 5000, tiers: "mode=progresif;50=4200;200=3600", category: "Merchandise" },
  { name: "Banner Flexi China 280gr", description: "Outdoor - hitung per m2 - include mata ayam", price: 25000, tiers: "basis=m2;5=23000;20=21000;50=19000", category: "Banner & Spanduk" },
  { name: "Spanduk Flexi Korea 340gr", description: "Outdoor heavy duty - per m2", price: 32000, tiers: "basis=m2;10=29000;30=26000", category: "Banner & Spanduk" },
  { name: "Stiker Vinyl Glossy", description: "Cetak + laminasi doff - per m2", price: 55000, tiers: "basis=m2;3=52000;10=48000", category: "Stiker" },
  { name: "Cutting Sticker Oracal", description: "Warna solid - per m2", price: 95000, tiers: "basis=m2;2=88000;5=80000", category: "Stiker" },
  { name: "Backdrop Flexi 440gr", description: "Indoor/outdoor - per m2", price: 40000, tiers: "mode=progresif;basis=m2;6=36000;20=32000", category: "Banner & Spanduk" },
  { name: "One Way Vision Kaca", description: "Per m2 - include pasang", price: 85000, tiers: "mode=progresif;basis=m2;4=78000;15=70000", category: "Stiker" },
  { name: "Sticker Label Bulat 4cm", description: "1 lembar isi 24 pcs", price: 5000, tiers: "", category: "Stiker" },
  { name: "Fotocopy A4 70gr", description: "Hitam putih 1 sisi", price: 350, tiers: "100=300;500=250;1000=200", category: "Jasa Kantor" },
  { name: "Jilid Spiral Kawat", description: "Maksimal 100 lembar", price: 15000, tiers: "", category: "Jasa Kantor" },
  { name: "Laminating A4 Panas", description: "Plastik 100 micron", price: 6000, tiers: "10=5000;50=4000", category: "Jasa Kantor" },
  { name: "Print Foto 4R Glossy", description: "Kertas foto premium", price: 3500, tiers: "20=3000;100=2500;500=2000", category: "Jasa Kantor" },
];

/**
 * Contoh VARIAN untuk file "Contoh CSV": kolom Induk berisi nama induk untuk
 * varian langsung, "*" untuk induk utama, dan "*NOTA" untuk sub-induk. Induk dibuat otomatis bila belum ada;
 * kategori isi mengikuti induknya. Contoh di sini sengaja satu tingkat supaya tetap ringkas.
 */
export const SAMPLE_VARIANTS: { name: string; description: string; price: number; tiers: string; category: string; parent: string }[] = [
  { name: "Print HVS", description: "Kertas HVS 70gr - pilih varian di bawah", price: 0, tiers: "", category: "Jasa Kantor", parent: "*" },
  { name: "A4 Warna", description: "Full color 1 sisi", price: 2000, tiers: "10=1800;50=1500;100=1200", category: "Jasa Kantor", parent: "Print HVS" },
  { name: "A4 Hitam Putih", description: "Hitam putih 1 sisi", price: 500, tiers: "10=450;50=400;100=350", category: "Jasa Kantor", parent: "Print HVS" },
  { name: "F4 Hitam Putih", description: "Hitam putih 1 sisi", price: 600, tiers: "", category: "Jasa Kantor", parent: "Print HVS" },
];
