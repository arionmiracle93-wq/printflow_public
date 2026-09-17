-- ============================================================
-- DATA CONTOH (DEMO) UNTUK CETAKPANTAU AI
-- Jalankan sekali, SETELAH tabel dibuat (drizzle-kit push / /api/setup).
-- Contoh:  psql "$DATABASE_URL" -f scripts/seed-demo.sql
-- Aman dijalankan ulang: hanya jalan bila tabel orders masih kosong.
-- ============================================================

DO $$
BEGIN
  IF (SELECT count(*) FROM orders) > 0 THEN
    RAISE NOTICE 'Tabel orders sudah berisi data. Seed dilewati.';
    RETURN;
  END IF;

  INSERT INTO customers (name, phone, email, address, notes) VALUES
    ('Toko Berkah Jaya', '081234567890', 'berkahjaya@mail.com', 'Jl. Pasar Baru 12', 'Pelanggan langganan spanduk, harga khusus'),
    ('Kantor Desa Sukamaju', '081298765432', NULL, 'Kantor Desa Sukamaju', 'Selalu minta invoice'),
    ('Kopi Senja', '085612345678', 'kopisenja@mail.com', 'Jl. Merdeka 45', 'Order menu & stiker gelas'),
    ('SMP Negeri 3', '081377788899', NULL, 'Jl. Pendidikan 8', 'Musiman: awal tahun ajaran'),
    ('Bu Rina (Event Organizer)', '087812345678', 'rina.eo@mail.com', 'Jl. Cempaka 3', 'Sering urgent, bayar DP 50%');

  -- Satu pekerjaan sekarang bisa berisi BEBERAPA produk, jadi jenis produk /
  -- jumlah / satuan tidak lagi disimpan di tabel orders, melainkan di tabel
  -- order_items. Pekerjaan "Order Pak Budi" di bawah sengaja dibuat berisi
  -- 3 produk sekaligus sebagai contoh fitur multi-item.
  WITH data (urut, customer_name, title, machine, operator, status, priority, price, paid, off, due_time, est, notes) AS (
    VALUES
      (1, 'Bu Rina (Event Organizer)', 'Backdrop seminar 3x2 meter', 'Large Format / Outdoor', 'Yoga', 'cetak', 'urgent', 900000, 450000, 0, '15:00', 6, 'Desain sudah OK. Butuh mata ayam dan tali.'),
      (2, 'Kopi Senja', 'Stiker gelas 300 pcs', 'Digital Print 1', 'Dimas', 'finishing', 'normal', 450000, 450000, 1, '17:00', 5, 'Bahan vinyl glossy, potong kiss-cut.'),
      (3, 'Toko Berkah Jaya', 'Order Pak Budi - paket promosi toko', 'Digital Print 2', 'Bu Rina', 'siap', 'normal', 950000, 950000, -1, '16:00', 8, 'Sudah dilaminasi doff. 1x kirim WA untuk semua item.'),
      (4, 'Kantor Desa Sukamaju', 'Buku profil desa 10 eksemplar', 'Mesin Offset', 'Pak Andi', 'antrian', 'tinggi', 3200000, 1000000, 4, '14:00', 22, 'Menunggu file revisi bab 2 dari sekretaris.'),
      (5, 'SMP Negeri 3', 'Sertifikat lomba 120 lembar', 'Digital Print 1', 'Dimas', 'desain', 'normal', 600000, 0, 2, '10:00', 6, 'Menunggu daftar nama pemenang.'),
      (6, 'Toko Berkah Jaya', 'Nota NPL 40 blok', 'Mesin Offset', 'Pak Andi', 'selesai', 'normal', 880000, 880000, -3, '17:00', 9, 'Sudah diambil sendiri oleh pemilik toko.'),
      (7, 'Bu Rina (Event Organizer)', 'Undangan pernikahan klien 250 pcs', 'Finishing & Binding', 'Tim Finishing', 'ditunda', 'tinggi', 3750000, 1500000, -1, '12:00', 26, 'Menunggu pelunasan DP kedua sebelum produksi.'),
      (8, 'Kopi Senja', 'Banner promo grand opening', 'Large Format / Outdoor', 'Yoga', 'qc', 'normal', 300000, 300000, 1, '17:00', 4, 'Cek hasil warna sebelum diserahkan.')
  )
  INSERT INTO orders (
    code, customer_id, customer_name, title, machine,
    operator, status, priority, price, paid_amount, due_date, due_time, est_hours, notes
  )
  SELECT
    'PJ-' || to_char(current_date, 'YYYY') || '-' || lpad(d.urut::text, 4, '0'),
    c.id, d.customer_name, d.title, d.machine,
    d.operator, d.status, d.priority, d.price, d.paid, (current_date + d.off), d.due_time, d.est, d.notes
  FROM data d
  JOIN customers c ON c.name = d.customer_name;

  -- Rincian produk tiap pekerjaan, dicocokkan lewat judul pekerjaan.
  WITH item_data (title, product_type, quantity, unit, position) AS (
    VALUES
      ('Backdrop seminar 3x2 meter', 'Spanduk / Banner', 2, 'pcs', 0),
      ('Stiker gelas 300 pcs', 'Stiker / Label', 300, 'pcs', 0),
      ('Order Pak Budi - paket promosi toko', 'Spanduk / Banner', 2, 'pcs', 0),
      ('Order Pak Budi - paket promosi toko', 'Stiker / Label', 500, 'lembar', 1),
      ('Order Pak Budi - paket promosi toko', 'Kartu Nama', 1, 'box', 2),
      ('Buku profil desa 10 eksemplar', 'Buku / Yasinan', 10, 'set', 0),
      ('Sertifikat lomba 120 lembar', 'Nota / Kop Surat', 120, 'lembar', 0),
      ('Nota NPL 40 blok', 'Nota / Kop Surat', 40, 'box', 0),
      ('Undangan pernikahan klien 250 pcs', 'Undangan', 250, 'pcs', 0),
      ('Banner promo grand opening', 'Spanduk / Banner', 3, 'meter', 0)
  )
  INSERT INTO order_items (order_id, product_type, quantity, unit, position)
  SELECT o.id, i.product_type, i.quantity, i.unit, i.position
  FROM item_data i
  JOIN orders o ON o.title = i.title;

  INSERT INTO order_events (order_id, from_status, to_status, note, actor)
  SELECT id, NULL, 'antrian', 'Pekerjaan dibuat dan masuk antrian.', 'Owner' FROM orders;

  INSERT INTO order_events (order_id, from_status, to_status, note, actor)
  SELECT id, 'antrian', status, 'Update status produksi.', 'Owner' FROM orders WHERE status <> 'antrian';

  RAISE NOTICE 'Seed selesai: % pelanggan, % pekerjaan.',
    (SELECT count(*) FROM customers), (SELECT count(*) FROM orders);
END $$;
