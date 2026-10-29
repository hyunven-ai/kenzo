'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import { getPenjualan, cancelBarangTerjual, deleteBarangTerjual } from '@/lib/db';
import { formatRupiah, formatDateTime, today } from '@/lib/utils';
import type { TrsPenjualanHdr, TrsPenjualanDtl } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

type FlattenedSoldItem = TrsPenjualanDtl & {
  nomor_invoice: string;
  customer: string;
  tanggal_penjualan: string;
  kasir: string;
  total_modal: number;
  total_jual: number;
  profit: number;
};

export default function BarangTerjualPage() {
  const user = getCurrentUser();
  const isSuperAdmin = user?.role === 'super_admin';

  const [rawSales, setRawSales] = useState<TrsPenjualanHdr[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [tempFrom, setTempFrom] = useState(today());
  const [tempTo, setTempTo] = useState(today());
  const [search, setSearch] = useState('');
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    tanggal_penjualan: true,
    nomor_invoice: true,
    customer: true,
    kategori: true,
    code: true,
    nama_barang: true,
    qty: true,
    harga_modal: true,
    harga_jual: true,
    total_jual: true,
    profit: true,
    kasir: true,
  });
  const [showColDropdown, setShowColDropdown] = useState(false);

  const load = async (f: string, t: string) => {
    setLoading(true);
    try {
      const result = await getPenjualan(f, t);
      setRawSales(result);
    } catch (err) {
      console.error('Error loading sold items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(from, to);
  }, []);

  const handleFilter = () => {
    setFrom(tempFrom);
    setTo(tempTo);
    load(tempFrom, tempTo);
  };

  const handleReset = () => {
    const f = today(), t = today();
    setTempFrom(f);
    setTempTo(t);
    setFrom(f);
    setTo(t);
    setSearch('');
    load(f, t);
  };

  const handleCancelItem = async (item: FlattenedSoldItem) => {
    const confirmation = confirm(
      `Apakah Anda yakin ingin membatalkan penjualan barang berikut?\n\n` +
      `Barang: ${item.nama_barang}\n` +
      `Code/IMEI: ${item.code || '-'}\n` +
      `Qty: ${item.qty}\n\n` +
      `Barang akan dikembalikan ke dalam stok dan data penjualan item ini akan dihapus.`
    );
    if (!confirmation) return;

    setCancellingId(item.id);
    try {
      await cancelBarangTerjual(item.id);
      alert('Penjualan barang berhasil dibatalkan dan stok dikembalikan.');
      load(from, to);
    } catch (e: any) {
      alert(e?.message || 'Gagal membatalkan penjualan barang');
    } finally {
      setCancellingId(null);
    }
  };

  const handleDeleteItem = async (item: FlattenedSoldItem) => {
    const confirmation = confirm(
      `Apakah Anda yakin ingin menghapus data penjualan barang berikut secara permanen?\n\n` +
      `Barang: ${item.nama_barang}\n` +
      `Code/IMEI: ${item.code || '-'}\n` +
      `Qty: ${item.qty}\n\n` +
      `PENTING: Barang TIDAK akan dikembalikan ke dalam stok. Penjualan item ini akan dihapus secara permanen.`
    );
    if (!confirmation) return;

    setCancellingId(item.id);
    try {
      await deleteBarangTerjual(item.id);
      alert('Data penjualan barang berhasil dihapus secara permanen.');
      load(from, to);
    } catch (e: any) {
      alert(e?.message || 'Gagal menghapus data penjualan barang');
    } finally {
      setCancellingId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', marginTop: '2rem' }}>
        <h2 style={{ color: '#d32f2f' }}>Akses Ditolak</h2>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>
          Halaman ini hanya dapat diakses oleh akun Super Admin.
        </p>
      </div>
    );
  }

  // Flatten raw sales details into individual sold items
  const soldItems: FlattenedSoldItem[] = [];
  rawSales.forEach((hdr) => {
    const dtls = (hdr as any).details ?? (hdr as any).trs_penjualan_dtl ?? [];
    dtls.forEach((dtl: TrsPenjualanDtl) => {
      const totalModal = dtl.harga_modal * dtl.qty;
      const totalJual = dtl.harga_jual * dtl.qty;
      const profit = totalJual - totalModal;

      soldItems.push({
        ...dtl,
        nomor_invoice: hdr.nomor_invoice,
        customer: hdr.customer,
        tanggal_penjualan: hdr.tanggal_penjualan,
        kasir: hdr.create_by ?? '-',
        total_modal: totalModal,
        total_jual: totalJual,
        profit: profit,
      });
    });
  });

  // Client-side search and additional filters if needed
  const filteredData = soldItems.filter((item) => {
    // Precise local timezone date comparison
    if (item.tanggal_penjualan) {
      const localDate = new Date(item.tanggal_penjualan);
      const y = localDate.getFullYear();
      const m = String(localDate.getMonth() + 1).padStart(2, '0');
      const d = String(localDate.getDate()).padStart(2, '0');
      const rowLocalDateStr = `${y}-${m}-${d}`;

      if (from && rowLocalDateStr < from) return false;
      if (to && rowLocalDateStr > to) return false;
    }

    if (search) {
      const q = search.toLowerCase();
      return (
        item.nama_barang.toLowerCase().includes(q) ||
        (item.code && item.code.toLowerCase().includes(q)) ||
        item.nomor_invoice.toLowerCase().includes(q) ||
        item.customer.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const columns = [
    {
      key: 'tanggal_penjualan',
      label: 'Tanggal Penjualan',
      render: (row: FlattenedSoldItem) => formatDateTime(row.tanggal_penjualan),
    },
    {
      key: 'nomor_invoice',
      label: 'No. Invoice',
      render: (row: FlattenedSoldItem) => <code style={{ fontSize: 11 }}>{row.nomor_invoice}</code>,
    },
    {
      key: 'customer',
      label: 'Pelanggan',
      render: (row: FlattenedSoldItem) => <strong>{row.customer}</strong>,
    },
    {
      key: 'kategori',
      label: 'Kategori',
      render: (row: FlattenedSoldItem) => (
        <span className="badge badge-info" style={{ fontSize: 11 }}>
          {row.kategori}
        </span>
      ),
    },
    {
      key: 'code',
      label: 'IMEI / Barcode',
      render: (row: FlattenedSoldItem) => <code>{row.code || '-'}</code>,
    },
    {
      key: 'nama_barang',
      label: 'Nama Barang',
      render: (row: FlattenedSoldItem) => <span>{row.nama_barang}</span>,
    },
    {
      key: 'qty',
      label: 'Qty',
      render: (row: FlattenedSoldItem) => <span>{row.qty}</span>,
    },
    {
      key: 'harga_modal',
      label: 'Harga Modal',
      render: (row: FlattenedSoldItem) => <span>{formatRupiah(row.harga_modal)}</span>,
    },
    {
      key: 'harga_jual',
      label: 'Harga Jual',
      render: (row: FlattenedSoldItem) => <span>{formatRupiah(row.harga_jual)}</span>,
    },
    {
      key: 'total_jual',
      label: 'Total Jual',
      render: (row: FlattenedSoldItem) => (
        <span style={{ fontWeight: 700, color: '#1565c0' }}>{formatRupiah(row.total_jual)}</span>
      ),
    },
    {
      key: 'profit',
      label: 'Keuntungan',
      render: (row: FlattenedSoldItem) => (
        <span style={{ color: '#2e7d32', fontWeight: 600 }}>{formatRupiah(row.profit)}</span>
      ),
    },
    {
      key: 'kasir',
      label: 'Kasir',
      render: (row: FlattenedSoldItem) => <span>{row.kasir}</span>,
    },
    {
      key: 'actions',
      label: 'Aksi',
      width: '180px',
      render: (row: FlattenedSoldItem) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => handleCancelItem(row)}
            disabled={cancellingId === row.id}
            style={{ whiteSpace: 'nowrap' }}
          >
            {cancellingId === row.id ? '...' : 'Cancel Jual'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDeleteItem(row)}
            disabled={cancellingId === row.id}
            style={{ whiteSpace: 'nowrap' }}
          >
            {cancellingId === row.id ? '...' : 'Hapus'}
          </button>
        </div>
      ),
    },
  ];

  const renderTableFooter = (sortedData: FlattenedSoldItem[]) => {
    const totalQty = sortedData.reduce((s, row) => s + row.qty, 0);
    const totalModalSum = sortedData.reduce((s, row) => s + row.total_modal, 0);
    const totalJualSum = sortedData.reduce((s, row) => s + row.total_jual, 0);
    const totalProfitSum = sortedData.reduce((s, row) => s + row.profit, 0);

    const activeCols = columns.filter(col => col.key === 'actions' || (visibleColumns[col.key] ?? true));
    const firstColKey = activeCols[0]?.key;

    return (
      <tr style={{ fontWeight: 700, background: '#f8f9fa', borderTop: '2px solid #ccc' }}>
        {activeCols.map((col) => {
          if (col.key === firstColKey) {
            return <td key={col.key} style={{ color: '#222' }}>Total</td>;
          }
          if (col.key === 'qty') {
            return <td key={col.key} style={{ color: '#222' }}>{totalQty}</td>;
          }
          if (col.key === 'harga_modal') {
            return <td key={col.key} style={{ color: '#222' }}>{formatRupiah(totalModalSum)}</td>;
          }
          if (col.key === 'harga_jual') {
            return <td key={col.key} style={{ color: '#222' }}>{formatRupiah(totalJualSum)}</td>;
          }
          if (col.key === 'total_jual') {
            return <td key={col.key} style={{ color: '#1565c0' }}>{formatRupiah(totalJualSum)}</td>;
          }
          if (col.key === 'profit') {
            return <td key={col.key} style={{ color: '#2e7d32' }}>{formatRupiah(totalProfitSum)}</td>;
          }
          return <td key={col.key}></td>;
        })}
      </tr>
    );
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">History Barang Terjual</h1>
          <p className="page-subtitle">Pantau dan kelola daftar item spesifik yang telah terjual</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ minWidth: 140, flex: '1 1 200px' }}>
          <label className="form-label">Dari Tanggal</label>
          <input
            type="date"
            className="form-control"
            value={tempFrom}
            onChange={(e) => setTempFrom(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ minWidth: 140, flex: '1 1 200px' }}>
          <label className="form-label">Sampai Tanggal</label>
          <input
            type="date"
            className="form-control"
            value={tempTo}
            onChange={(e) => setTempTo(e.target.value)}
          />
        </div>
        <div className="form-group" style={{ minWidth: 200, flex: '2 1 300px' }}>
          <label className="form-label">Cari Barang / IMEI / Invoice / Pelanggan</label>
          <input
            type="text"
            className="form-control"
            placeholder="Cari..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, height: 38, flex: '1 1 auto', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" style={{ flex: 1, minWidth: 80 }} onClick={handleReset}>
            Reset
          </button>
          <button className="btn btn-primary" style={{ flex: 1, minWidth: 80 }} onClick={handleFilter}>
            Filter
          </button>
        </div>
      </div>

      {/* Data Table Card */}
      <div className="card">
        <DataTable
          data={filteredData}
          columns={columns.filter(col => col.key === 'actions' || (visibleColumns[col.key] ?? true))}
          loading={loading}
          renderFooter={renderTableFooter}
          extraActions={
            <div style={{ position: 'relative' }}>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={() => setShowColDropdown(!showColDropdown)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34 }}
                id="btn-toggle-columns"
              >
                ⚙️ Kolom
              </button>
              {showColDropdown && (
                <>
                  <div 
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                    onClick={() => setShowColDropdown(false)} 
                  />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 6,
                    boxShadow: 'var(--shadow-md)',
                    padding: 12,
                    zIndex: 100,
                    minWidth: 160,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    marginTop: 6
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', paddingBottom: 6, marginBottom: 2 }}>
                      Tampilkan Kolom
                    </div>
                    {Object.entries({
                      tanggal_penjualan: 'Tanggal',
                      nomor_invoice: 'No. Invoice',
                      customer: 'Pelanggan',
                      kategori: 'Kategori',
                      code: 'IMEI / Barcode',
                      nama_barang: 'Nama Barang',
                      qty: 'Qty',
                      harga_modal: 'Harga Modal',
                      harga_jual: 'Harga Jual',
                      total_jual: 'Total Jual',
                      profit: 'Keuntungan',
                      kasir: 'Kasir',
                    }).map(([key, label]) => (
                      <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', color: '#333' }}>
                        <input
                          type="checkbox"
                          checked={visibleColumns[key] ?? true}
                          onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
