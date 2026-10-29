import { NextResponse } from 'next/server';
import { sql } from '@/lib/neon';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (!sql) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL belum dikonfigurasi' }, { status: 500 });
  }

  try {
    if (action === 'ping') {
      const result = await sql`SELECT version();`;
      const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
      return NextResponse.json({
        ok: true,
        message: 'Neon DB Terhubung!',
        version: result[0]?.version,
        tablesCount: tables.length,
        tables: tables.map(t => t.table_name),
      });
    }

    if (action === 'getKategoris') {
      const data = await sql`SELECT * FROM public.ms_kategori ORDER BY nama;`;
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'getBarangs') {
      const kategori = searchParams.get('kategori');
      let data;
      if (kategori && kategori !== 'semua') {
        data = await sql`SELECT * FROM public.ms_barang WHERE kategori = ${kategori} ORDER BY create_time DESC;`;
      } else {
        data = await sql`SELECT * FROM public.ms_barang ORDER BY create_time DESC;`;
      }
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'getMerks') {
      const data = await sql`SELECT * FROM public.ms_merk ORDER BY nama;`;
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'getSuppliers') {
      const data = await sql`SELECT * FROM public.ms_supplier ORDER BY nama;`;
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'getOperators') {
      const data = await sql`SELECT * FROM public.ms_operator ORDER BY nama;`;
      return NextResponse.json({ ok: true, data });
    }

    // --- PENCARIAN BARANG POS / KASIR ---
    if (action === 'searchProducts') {
      const q = searchParams.get('q') || '';
      const pattern = `%${q}%`;
      const data = await sql`
        SELECT * FROM public.ms_barang
        WHERE (nama ILIKE ${pattern} OR merk ILIKE ${pattern} OR barcode ILIKE ${pattern} OR kategori ILIKE ${pattern})
          AND qty > 0
        ORDER BY nama ASC
        LIMIT 20;
      `;
      return NextResponse.json({ ok: true, data });
    }

    if (action === 'searchBarcode') {
      const barcode = searchParams.get('barcode') || '';
      const pattern = `%${barcode}%`;
      const data = await sql`
        SELECT * FROM public.ms_barang
        WHERE (barcode ILIKE ${barcode} OR id::text = ${barcode} OR nama ILIKE ${pattern})
          AND qty > 0
        ORDER BY (barcode = ${barcode}) DESC, nama ASC
        LIMIT 1;
      `;
      return NextResponse.json({ ok: true, data: data[0] || null });
    }

    // --- GET PENJUALAN LENGKAP DENGAN DETAIL ---
    if (action === 'getPenjualan') {
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      let rows;
      if (from && to) {
        rows = await sql`
          SELECT 
            h.id,
            h.nomor_invoice,
            h.customer,
            h.status,
            h.metode_pembayaran,
            h.total_harga,
            h.catatan,
            h.tanggal_penjualan,
            h.create_time,
            h.create_by,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'idhdr', d.idhdr,
                  'idbarang', d.idbarang,
                  'kategori', d.kategori,
                  'code', d.code,
                  'nama_barang', d.nama_barang,
                  'qty', d.qty,
                  'harga_modal', d.harga_modal,
                  'harga_jual', d.harga_jual,
                  'supplier', d.supplier,
                  'create_time', d.create_time,
                  'create_by', d.create_by
                )
              ) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) AS details
          FROM public.trs_penjualan_hdr h
          LEFT JOIN public.trs_penjualan_dtl d ON d.idhdr = h.id
          WHERE h.tanggal_penjualan >= ${from}::timestamp AND h.tanggal_penjualan <= ${to + ' 23:59:59'}::timestamp
          GROUP BY h.id
          ORDER BY h.tanggal_penjualan DESC;
        `;
      } else {
        rows = await sql`
          SELECT 
            h.id,
            h.nomor_invoice,
            h.customer,
            h.status,
            h.metode_pembayaran,
            h.total_harga,
            h.catatan,
            h.tanggal_penjualan,
            h.create_time,
            h.create_by,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', d.id,
                  'idhdr', d.idhdr,
                  'idbarang', d.idbarang,
                  'kategori', d.kategori,
                  'code', d.code,
                  'nama_barang', d.nama_barang,
                  'qty', d.qty,
                  'harga_modal', d.harga_modal,
                  'harga_jual', d.harga_jual,
                  'supplier', d.supplier,
                  'create_time', d.create_time,
                  'create_by', d.create_by
                )
              ) FILTER (WHERE d.id IS NOT NULL),
              '[]'::json
            ) AS details
          FROM public.trs_penjualan_hdr h
          LEFT JOIN public.trs_penjualan_dtl d ON d.idhdr = h.id
          GROUP BY h.id
          ORDER BY h.tanggal_penjualan DESC;
        `;
      }
      return NextResponse.json({ ok: true, data: rows });
    }

    // --- DASHBOARD STATS ---
    if (action === 'getDashboardStats') {
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      let statsQuery;
      if (from && to) {
        statsQuery = sql`
          SELECT 
            COALESCE(SUM(d.harga_jual * d.qty), 0) AS total_pemasukan,
            COALESCE(SUM(d.harga_modal * d.qty), 0) AS total_pengeluaran
          FROM public.trs_penjualan_hdr h
          JOIN public.trs_penjualan_dtl d ON d.idhdr = h.id
          WHERE h.tanggal_penjualan >= ${from}::timestamp AND h.tanggal_penjualan <= ${to + ' 23:59:59'}::timestamp;
        `;
      } else {
        statsQuery = sql`
          SELECT 
            COALESCE(SUM(d.harga_jual * d.qty), 0) AS total_pemasukan,
            COALESCE(SUM(d.harga_modal * d.qty), 0) AS total_pengeluaran
          FROM public.trs_penjualan_hdr h
          JOIN public.trs_penjualan_dtl d ON d.idhdr = h.id;
        `;
      }

      // Hitung stok & aset produk
      const [statsRes, barangRes] = await Promise.all([
        statsQuery,
        sql`SELECT COALESCE(SUM(qty), 0) AS total_qty, COALESCE(SUM(harga_modal * qty), 0) AS total_aset FROM public.ms_barang;`,
      ]);

      const stat = statsRes[0] || {};
      const barang = barangRes[0] || {};
      const total_pemasukan = Number(stat.total_pemasukan || 0);
      const total_pengeluaran = Number(stat.total_pengeluaran || 0);

      return NextResponse.json({
        ok: true,
        data: {
          total_pemasukan,
          total_pengeluaran,
          total_keuntungan: total_pemasukan - total_pengeluaran,
          total_produk: Number(barang.total_qty || 0),
          total_aset: Number(barang.total_aset || 0),
        },
      });
    }

    // --- USER MANAGEMENT ---
    if (action === 'getUsers') {
      const users = await sql`
        SELECT id, username, nama_lengkap, role, is_active, create_time, create_by
        FROM public.ms_user
        ORDER BY id ASC;
      `;
      return NextResponse.json({ ok: true, data: users });
    }

    // --- AUDIT TRAIL LOG AKTIVITAS ---
    if (action === 'getLogs') {
      const logs = await sql`
        SELECT id, username as user, aksi, tabel, detail, waktu
        FROM public.log_aktivitas
        ORDER BY waktu DESC
        LIMIT 200;
      `;
      return NextResponse.json({ ok: true, data: logs });
    }

    // --- LOG BARANG MASUK ---
    if (action === 'getItemEntryLogs') {
      const logs = await sql`
        SELECT id, username as user, aksi, tabel, detail, waktu
        FROM public.log_aktivitas
        WHERE aksi = 'INSERT' AND (tabel = 'ms_barang' OR tabel LIKE 'ms_%')
        ORDER BY waktu DESC
        LIMIT 200;
      `;
      return NextResponse.json({ ok: true, data: logs });
    }

    // --- GARANSI (GET) ---
    if (action === 'getGaransi') {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS public.garansi (
            id SERIAL PRIMARY KEY,
            id_transaksi VARCHAR(100),
            nama_pelanggan VARCHAR(255) NOT NULL,
            nomor_whatsapp VARCHAR(50),
            imei1 VARCHAR(50),
            imei2 VARCHAR(50),
            nomor_seri VARCHAR(100),
            merk_tipe VARCHAR(255) NOT NULL,
            warna_kapasitas VARCHAR(100),
            tanggal_pembelian DATE NOT NULL DEFAULT CURRENT_DATE,
            durasi_garansi VARCHAR(50) DEFAULT '1 Tahun',
            jenis_garansi VARCHAR(50) DEFAULT 'Resmi',
            status_garansi VARCHAR(50) DEFAULT 'Aktif',
            create_time TIMESTAMPTZ DEFAULT now(),
            create_by VARCHAR(100),
            update_time TIMESTAMPTZ,
            update_by VARCHAR(100)
          );
        `;
        const data = await sql`SELECT * FROM public.garansi ORDER BY create_time DESC;`;
        return NextResponse.json({ ok: true, data });
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: false, error: 'Aksi GET tidak dikenali' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Neon API GET Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!sql) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL belum dikonfigurasi' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, payload } = body;

    // --- KATEGORI ---
    if (action === 'createKategori') {
      const res = await sql`
        INSERT INTO public.ms_kategori (kode, nama, jenis_toko, satuan_default, keterangan, create_by)
        VALUES (${payload.kode}, ${payload.nama}, ${payload.jenis_toko || 'kelontong'}, ${payload.satuan_default || 'Pcs'}, ${payload.keterangan || null}, ${payload.create_by || null})
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'updateKategori') {
      const res = await sql`
        UPDATE public.ms_kategori
        SET kode = ${payload.kode}, nama = ${payload.nama}, jenis_toko = ${payload.jenis_toko}, satuan_default = ${payload.satuan_default}, keterangan = ${payload.keterangan || null}, update_time = now(), update_by = ${payload.update_by || null}
        WHERE id = ${payload.id}
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'deleteKategori') {
      await sql`DELETE FROM public.ms_kategori WHERE id = ${payload.id};`;
      return NextResponse.json({ ok: true });
    }

    // --- BARANG ---
    if (action === 'createBarang') {
      const res = await sql`
        INSERT INTO public.ms_barang (barcode, nama, kategori, merk, supplier, satuan, qty, harga_modal, harga_jual, warna, ukuran, keterangan, create_by)
        VALUES (${payload.barcode}, ${payload.nama}, ${payload.kategori}, ${payload.merk || null}, ${payload.supplier || null}, ${payload.satuan || 'Pcs'}, ${payload.qty || 0}, ${payload.harga_modal || 0}, ${payload.harga_jual || 0}, ${payload.warna || null}, ${payload.ukuran || null}, ${payload.keterangan || null}, ${payload.create_by || null})
        RETURNING *;
      `;
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${payload.create_by || 'admin'}, 'INSERT', 'ms_barang', ${'Barang masuk: ' + payload.nama + ' (' + payload.barcode + ', Stok: ' + (payload.qty || 0) + ')'}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'updateBarang') {
      const res = await sql`
        UPDATE public.ms_barang
        SET barcode = ${payload.barcode}, nama = ${payload.nama}, kategori = ${payload.kategori}, merk = ${payload.merk || null}, supplier = ${payload.supplier || null}, satuan = ${payload.satuan || 'Pcs'}, qty = ${payload.qty || 0}, harga_modal = ${payload.harga_modal || 0}, harga_jual = ${payload.harga_jual || 0}, warna = ${payload.warna || null}, ukuran = ${payload.ukuran || null}, keterangan = ${payload.keterangan || null}, update_time = now(), update_by = ${payload.update_by || null}
        WHERE id = ${payload.id}
        RETURNING *;
      `;
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${payload.update_by || 'admin'}, 'UPDATE', 'ms_barang', ${'Ubah data barang: ' + payload.nama + ' (Stok: ' + (payload.qty || 0) + ')'}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'deleteBarang') {
      await sql`DELETE FROM public.ms_barang WHERE id = ${payload.id};`;
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES ('admin', 'DELETE', 'ms_barang', ${'Hapus data barang ID: ' + payload.id}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true });
    }

    // --- SYNC PENJUALAN OFFLINE KE NEON ---
    if (action === 'syncPenjualan') {
      const { header, items } = payload;
      const hdrRes = await sql`
        INSERT INTO public.trs_penjualan_hdr (nomor_invoice, customer, status, metode_pembayaran, total_harga, catatan, tanggal_penjualan, create_by)
        VALUES (${header.nomor_invoice}, ${header.customer || 'Umum'}, 1, ${header.metode_pembayaran || 'Tunai'}, ${header.total_harga || 0}, ${header.catatan || null}, ${header.tanggal_penjualan || new Date().toISOString()}, ${header.create_by || null})
        ON CONFLICT (nomor_invoice) DO NOTHING
        RETURNING id;
      `;

      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${header.create_by || 'kasir'}, 'INSERT', 'trs_penjualan_hdr', ${'Penjualan invoice: ' + header.nomor_invoice + ' (Total: Rp ' + Number(header.total_harga || 0).toLocaleString('id-ID') + ')'}, now());
        `;
      } catch {}

      let idhdr = hdrRes[0]?.id;
      if (!idhdr) {
        const existingHdr = await sql`SELECT id FROM public.trs_penjualan_hdr WHERE nomor_invoice = ${header.nomor_invoice} LIMIT 1;`;
        idhdr = existingHdr[0]?.id;
      }

      if (idhdr && items && items.length > 0) {
        for (const it of items) {
          await sql`
            INSERT INTO public.trs_penjualan_dtl (idhdr, idbarang, kategori, code, nama_barang, qty, harga_modal, harga_jual, supplier)
            VALUES (${idhdr}, ${it.idbarang || 0}, ${it.kategori || 'Umum'}, ${it.code || '-'}, ${it.nama_barang}, ${it.qty || 1}, ${it.harga_modal || 0}, ${it.harga_jual || 0}, ${it.supplier || null})
            ON CONFLICT (idhdr, code, nama_barang) DO NOTHING;
          `;
          // Potong stok di ms_barang
          await sql`
            UPDATE public.ms_barang
            SET qty = GREATEST(0, qty - ${it.qty || 1}), update_time = now()
            WHERE barcode = ${it.code} OR id = ${it.idbarang};
          `;
        }
      }
      return NextResponse.json({ ok: true, message: 'Transaksi berhasil disinkronkan ke Neon DB' });
    }

    // --- HAPUS / BATALKAN PENJUALAN ---
    if (action === 'deletePenjualan') {
      const details = await sql`SELECT * FROM public.trs_penjualan_dtl WHERE idhdr = ${payload.id};`;
      for (const d of details) {
        await sql`
          UPDATE public.ms_barang
          SET qty = qty + ${d.qty || 1}, update_time = now()
          WHERE id = ${d.idbarang} OR barcode = ${d.code};
        `;
      }
      await sql`DELETE FROM public.trs_penjualan_hdr WHERE id = ${payload.id};`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancelBarangTerjual') {
      const dtl = await sql`SELECT * FROM public.trs_penjualan_dtl WHERE id = ${payload.id};`;
      if (dtl.length > 0) {
        const { idhdr, idbarang, code, harga_jual, qty } = dtl[0];
        // Kembalikan stok
        await sql`
          UPDATE public.ms_barang 
          SET qty = qty + ${qty || 1}, update_time = now()
          WHERE id = ${idbarang} OR barcode = ${code};
        `;
        await sql`DELETE FROM public.trs_penjualan_dtl WHERE id = ${payload.id};`;
        const remaining = await sql`SELECT id FROM public.trs_penjualan_dtl WHERE idhdr = ${idhdr};`;
        if (remaining.length === 0) {
          await sql`DELETE FROM public.trs_penjualan_hdr WHERE id = ${idhdr};`;
        } else {
          await sql`
            UPDATE public.trs_penjualan_hdr 
            SET total_harga = GREATEST(0, total_harga - ${harga_jual * qty}), update_time = now() 
            WHERE id = ${idhdr};
          `;
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'deleteBarangTerjual') {
      const dtl = await sql`SELECT * FROM public.trs_penjualan_dtl WHERE id = ${payload.id};`;
      if (dtl.length > 0) {
        const { idhdr, harga_jual, qty } = dtl[0];
        await sql`DELETE FROM public.trs_penjualan_dtl WHERE id = ${payload.id};`;
        const remaining = await sql`SELECT id FROM public.trs_penjualan_dtl WHERE idhdr = ${idhdr};`;
        if (remaining.length === 0) {
          await sql`DELETE FROM public.trs_penjualan_hdr WHERE id = ${idhdr};`;
        } else {
          await sql`
            UPDATE public.trs_penjualan_hdr 
            SET total_harga = GREATEST(0, total_harga - ${harga_jual * qty}), update_time = now() 
            WHERE id = ${idhdr};
          `;
        }
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'updatePenjualanHeader') {
      const res = await sql`
        UPDATE public.trs_penjualan_hdr
        SET customer = ${payload.customer || 'Umum'},
            metode_pembayaran = ${payload.metode_pembayaran || 'Tunai'},
            tanggal_penjualan = ${payload.tanggal_penjualan || new Date().toISOString()}::timestamp,
            create_by = ${payload.create_by || null},
            update_time = now()
        WHERE id = ${payload.id}
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }

    // --- MASTER MERK, SUPPLIER, OPERATOR ---
    if (action === 'createMerk') {
      const res = await sql`
        INSERT INTO public.ms_merk (nama, create_by)
        VALUES (${payload.nama}, ${payload.create_by || null})
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }
    if (action === 'deleteMerk') {
      await sql`DELETE FROM public.ms_merk WHERE id = ${payload.id};`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'createSupplier') {
      const res = await sql`
        INSERT INTO public.ms_supplier (nama, create_by)
        VALUES (${payload.nama}, ${payload.create_by || null})
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }
    if (action === 'deleteSupplier') {
      await sql`DELETE FROM public.ms_supplier WHERE id = ${payload.id};`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'createOperator') {
      const res = await sql`
        INSERT INTO public.ms_operator (nama, create_by)
        VALUES (${payload.nama}, ${payload.create_by || null})
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }
    if (action === 'deleteOperator') {
      await sql`DELETE FROM public.ms_operator WHERE id = ${payload.id};`;
      return NextResponse.json({ ok: true });
    }

    // --- USER MANAGEMENT (POST) ---
    if (action === 'createUser') {
      const res = await sql`
        INSERT INTO public.ms_user (username, nama_lengkap, password_hash, role, is_active, create_by, create_time)
        VALUES (${payload.username}, ${payload.nama_lengkap}, ${payload.password || '123456'}, ${payload.role || 'kasir'}, ${payload.is_active ?? true}, ${payload.create_by || 'admin'}, now())
        RETURNING id, username, nama_lengkap, role, is_active, create_time;
      `;
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${payload.create_by || 'admin'}, 'INSERT', 'ms_user', ${'Tambah user: @' + payload.username + ' (' + payload.role + ')'}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'updateUser') {
      let res;
      if (payload.password) {
        res = await sql`
          UPDATE public.ms_user
          SET username = COALESCE(${payload.username}, username),
              nama_lengkap = COALESCE(${payload.nama_lengkap}, nama_lengkap),
              role = COALESCE(${payload.role}, role),
              is_active = COALESCE(${payload.is_active}, is_active),
              password_hash = ${payload.password},
              update_time = now(),
              update_by = ${payload.update_by || 'admin'}
          WHERE id = ${payload.id}
          RETURNING id, username, nama_lengkap, role, is_active;
        `;
      } else {
        res = await sql`
          UPDATE public.ms_user
          SET username = COALESCE(${payload.username}, username),
              nama_lengkap = COALESCE(${payload.nama_lengkap}, nama_lengkap),
              role = COALESCE(${payload.role}, role),
              is_active = COALESCE(${payload.is_active}, is_active),
              update_time = now(),
              update_by = ${payload.update_by || 'admin'}
          WHERE id = ${payload.id}
          RETURNING id, username, nama_lengkap, role, is_active;
        `;
      }
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${payload.update_by || 'admin'}, 'UPDATE', 'ms_user', ${'Ubah data user ID ' + payload.id + (payload.username ? ' (@' + payload.username + ')' : '')}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'deleteUser') {
      const user = await sql`SELECT username FROM public.ms_user WHERE id = ${payload.id} LIMIT 1;`;
      const uname = user[0]?.username || payload.id;
      await sql`DELETE FROM public.ms_user WHERE id = ${payload.id};`;
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES ('admin', 'DELETE', 'ms_user', ${'Hapus user: @' + uname}, now());
        `;
      } catch {}
      return NextResponse.json({ ok: true });
    }

    // --- AUDIT TRAIL LOG AKTIVITAS (POST) ---
    if (action === 'writeLog') {
      await sql`
        INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
        VALUES (${payload.username || 'system'}, ${payload.aksi || 'INFO'}, ${payload.tabel || 'system'}, ${payload.detail || '-'}, now());
      `;
      return NextResponse.json({ ok: true });
    }

    // --- AUTHENTICATION LOGIN DENGAN NEON DB ---
    if (action === 'login') {
      const username = (payload?.username || '').trim();
      const password = (payload?.password || '').trim();

      if (!username || !password) {
        return NextResponse.json({ ok: false, error: 'Username dan password wajib diisi' }, { status: 400 });
      }

      const rows = await sql`
        SELECT id, username, nama_lengkap, password_hash, role, is_active
        FROM public.ms_user
        WHERE LOWER(username) = LOWER(${username})
        LIMIT 1;
      `;

      if (rows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Username atau password salah' }, { status: 401 });
      }

      const user = rows[0];

      if (!user.is_active) {
        return NextResponse.json({ ok: false, error: 'Akun dinonaktifkan. Hubungi Administrator.' }, { status: 403 });
      }

      // Validasi password terhadap password_hash
      if (user.password_hash !== password) {
        return NextResponse.json({ ok: false, error: 'Username atau password salah' }, { status: 401 });
      }

      // Catat waktu login terakhir
      try {
        await sql`UPDATE public.ms_user SET last_login = now() WHERE id = ${user.id};`;
      } catch {}

      // Catat ke audit trail log aktivitas
      try {
        await sql`
          INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
          VALUES (${user.username}, 'LOGIN', 'ms_user', ${'User @' + user.username + ' berhasil login (' + user.role + ')'}, now());
        `;
      } catch {}

      return NextResponse.json({
        ok: true,
        data: {
          id: user.id,
          username: user.username,
          nama_lengkap: user.nama_lengkap,
          role: user.role,
        },
      });
    }

    // --- GARANSI (POST) ---
    if (action === 'createGaransi') {
      try {
        await sql`
          CREATE TABLE IF NOT EXISTS public.garansi (
            id SERIAL PRIMARY KEY,
            id_transaksi VARCHAR(100),
            nama_pelanggan VARCHAR(255) NOT NULL,
            nomor_whatsapp VARCHAR(50),
            imei1 VARCHAR(50),
            imei2 VARCHAR(50),
            nomor_seri VARCHAR(100),
            merk_tipe VARCHAR(255) NOT NULL,
            warna_kapasitas VARCHAR(100),
            tanggal_pembelian DATE NOT NULL DEFAULT CURRENT_DATE,
            durasi_garansi VARCHAR(50) DEFAULT '1 Tahun',
            jenis_garansi VARCHAR(50) DEFAULT 'Resmi',
            status_garansi VARCHAR(50) DEFAULT 'Aktif',
            create_time TIMESTAMPTZ DEFAULT now(),
            create_by VARCHAR(100),
            update_time TIMESTAMPTZ,
            update_by VARCHAR(100)
          );
        `;
        const res = await sql`
          INSERT INTO public.garansi (
            id_transaksi, nama_pelanggan, nomor_whatsapp, imei1, imei2, nomor_seri, merk_tipe,
            warna_kapasitas, tanggal_pembelian, durasi_garansi, jenis_garansi, status_garansi, create_by
          ) VALUES (
            ${payload.id_transaksi}, ${payload.nama_pelanggan}, ${payload.nomor_whatsapp || null},
            ${payload.imei1 || null}, ${payload.imei2 || null}, ${payload.nomor_seri || null},
            ${payload.merk_tipe}, ${payload.warna_kapasitas || null}, ${payload.tanggal_pembelian || null},
            ${payload.durasi_garansi || '1 Tahun'}, ${payload.jenis_garansi || 'Resmi'},
            ${payload.status_garansi || 'Aktif'}, ${payload.create_by || null}
          )
          RETURNING *;
        `;
        try {
          await sql`
            INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
            VALUES (${payload.create_by || 'admin'}, 'INSERT', 'garansi', ${'Tambah Garansi: ' + payload.nama_pelanggan + ' (' + payload.merk_tipe + ')'}, now());
          `;
        } catch {}
        return NextResponse.json({ ok: true, data: res[0] });
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    if (action === 'updateGaransi') {
      try {
        const res = await sql`
          UPDATE public.garansi
          SET id_transaksi = ${payload.id_transaksi},
              nama_pelanggan = ${payload.nama_pelanggan},
              nomor_whatsapp = ${payload.nomor_whatsapp || null},
              imei1 = ${payload.imei1 || null},
              imei2 = ${payload.imei2 || null},
              nomor_seri = ${payload.nomor_seri || null},
              merk_tipe = ${payload.merk_tipe},
              warna_kapasitas = ${payload.warna_kapasitas || null},
              tanggal_pembelian = ${payload.tanggal_pembelian || null},
              durasi_garansi = ${payload.durasi_garansi || '1 Tahun'},
              jenis_garansi = ${payload.jenis_garansi || 'Resmi'},
              status_garansi = ${payload.status_garansi || 'Aktif'},
              update_time = now(),
              update_by = ${payload.update_by || null}
          WHERE id = ${payload.id}
          RETURNING *;
        `;
        try {
          await sql`
            INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
            VALUES (${payload.update_by || 'admin'}, 'UPDATE', 'garansi', ${'Ubah Garansi ID ' + payload.id + ' (' + payload.nama_pelanggan + ')'}, now());
          `;
        } catch {}
        return NextResponse.json({ ok: true, data: res[0] });
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    if (action === 'deleteGaransi') {
      try {
        await sql`DELETE FROM public.garansi WHERE id = ${payload.id};`;
        try {
          await sql`
            INSERT INTO public.log_aktivitas (username, aksi, tabel, detail, waktu)
            VALUES ('admin', 'DELETE', 'garansi', ${'Hapus Garansi ID: ' + payload.id}, now());
          `;
        } catch {}
        return NextResponse.json({ ok: true });
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: false, error: 'Aksi POST tidak dikenali' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Neon API POST Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 }
    );
  }
}
