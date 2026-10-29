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
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'updateBarang') {
      const res = await sql`
        UPDATE public.ms_barang
        SET barcode = ${payload.barcode}, nama = ${payload.nama}, kategori = ${payload.kategori}, merk = ${payload.merk || null}, supplier = ${payload.supplier || null}, satuan = ${payload.satuan || 'Pcs'}, qty = ${payload.qty || 0}, harga_modal = ${payload.harga_modal || 0}, harga_jual = ${payload.harga_jual || 0}, warna = ${payload.warna || null}, ukuran = ${payload.ukuran || null}, keterangan = ${payload.keterangan || null}, update_time = now(), update_by = ${payload.update_by || null}
        WHERE id = ${payload.id}
        RETURNING *;
      `;
      return NextResponse.json({ ok: true, data: res[0] });
    }

    if (action === 'deleteBarang') {
      await sql`DELETE FROM public.ms_barang WHERE id = ${payload.id};`;
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

    return NextResponse.json({ ok: false, error: 'Aksi POST tidak dikenali' }, { status: 400 });
  } catch (err: unknown) {
    console.error('Neon API POST Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Database error' },
      { status: 500 }
    );
  }
}
