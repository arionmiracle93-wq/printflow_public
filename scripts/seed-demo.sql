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

  WITH data (customer_name, title, product_type, quantity, unit, machine, operator, status, priority, price, paid, off, due_time, est, notes) AS (
    VALUES
      ('Bu Rina (Event Organizer)', 'Backdrop seminar 3x2 meter', 'Spanduk / Banner', 2, 'pcs', 'Large Format / Outdoor', 'Yoga', 'cetak', 'urgent', 900000, 450000, 0, '15:00', 6, 'Desain sudah OK. Butuh mata ayam dan tali.'),
      ('Kopi Senja', 'Stiker gelas 300 pcs', 'Stiker / Label', 300, 'pcs', 'Digital Print 1', 'Dimas', 'finishing', 'normal', 450000, 450000, 1, '17:00', 5, 'Bahan vinyl glossy, potong kiss-cut.'),
      ('Toko Berkah Jaya', 'Kartu nama 5 box', 'Kartu Nama', 500, 'pcs', 'Digital Print 2', 'Bu Rina', 'siap', 'normal', 175000, 175000, -1, '16:00', 3, 'Sudah dilaminasi doff.'),
      ('Kantor Desa Sukamaju', 'Buku profil desa 10 eksemplar', 'Buku / Yasinan', 10, 'set', 'Mesin Offset', 'Pak Andi', 'antrian', 'tinggi', 3200000, 1000000, 4, '14:00', 22, 'Menunggu file revisi bab 2 dari sekretaris.'),
      ('SMP Negeri 3', 'Sertifikat lomba 120 lembar', 'Nota / Kop Surat', 120, 'lembar', 'Digital Print 1', 'Dimas', 'desain', 'normal', 600000, 0, 2, '10:00', 6, 'Menunggu daftar nama pemenang.'),
      ('Toko Berkah Jaya', 'Nota NPL 40 blok', 'Nota / Kop Surat', 40, 'box', 'Mesin Offset', 'Pak Andi', 'selesai', 'normal', 880000, 880000, -3, '17:00', 9, 'Sudah diambil sendiri oleh pemilik toko.'),
      ('Bu Rina (Event Organizer)', 'Undangan pernikahan klien 250 pcs', 'Undangan', 250, 'pcs', 'Finishing & Binding', 'Tim Finishing', 'ditunda', 'tinggi', 3750000, 1500000, -1, '12:00', 26, 'Menunggu pelunasan DP kedua sebelum produksi.'),
      ('Kopi Senja', 'Banner promo grand opening', 'Spanduk / Banner', 3, 'meter', 'Large Format / Outdoor', 'Yoga', 'qc', 'normal', 300000, 300000, 1, '17:00', 4, 'Cek hasil warna sebelum diserahkan.')
  )
  INSERT INTO orders (
    code, customer_id, customer_name, title, product_type, quantity, unit, machine,
    operator, status, priority, price, paid_amount, due_date, due_time, est_hours, notes
  )
  SELECT
    'PJ-' || to_char(current_date, 'YYYY') || '-' || lpad((row_number() OVER ())::text, 4, '0'),
    c.id, d.customer_name, d.title, d.product_type, d.quantity, d.unit, d.machine,
    d.operator, d.status, d.priority, d.price, d.paid, (current_date + d.off), d.due_time, d.est, d.notes
  FROM data d
  JOIN customers c ON c.name = d.customer_name;

  INSERT INTO order_events (order_id, from_status, to_status, note, actor)
  SELECT id, NULL, 'antrian', 'Pekerjaan dibuat dan masuk antrian.', 'Owner' FROM orders;

  INSERT INTO order_events (order_id, from_status, to_status, note, actor)
  SELECT id, 'antrian', status, 'Update status produksi.', 'Owner' FROM orders WHERE status <> 'antrian';

  RAISE NOTICE 'Seed selesai: % pelanggan, % pekerjaan.',
    (SELECT count(*) FROM customers), (SELECT count(*) FROM orders);
END $$;
