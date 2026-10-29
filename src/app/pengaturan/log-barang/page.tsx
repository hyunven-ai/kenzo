'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import { formatDateTime } from '@/lib/utils';
import { getItemEntryLogs } from '@/lib/db';
import type { LogAktivitas } from '@/lib/types';

export default function LogBarangPage() {
  const [logs, setLogs] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const data = await getItemEntryLogs();
        setLogs(data);
      } catch (e) {
        console.error('Gagal mengambil data log barang:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, []);

  // Map database table name to user-friendly category name
  const getCategoryName = (table: string) => {
    switch (table) {
      case 'ms_barang':
        return 'Stock Produk';
      case 'ms_aksesoris':
        return 'Aksesoris';
      case 'ms_kuota':
        return 'Kuota';
      case 'ms_hp_dtl':
        return 'HP';
      case 'ms_hp_dtl_non_pajak':
        return 'HP Non Pajak';
      case 'ms_cctv_dtl':
        return 'CCTV';
      case 'ms_sparepart':
        return 'Sparepart';
      default:
        return table || 'Stock Produk';
    }
  };

  const columns = [
    {
      key: 'waktu', label: 'Waktu Masuk',
      render: (row: LogAktivitas) => (
        <span style={{ fontSize: 12, color: '#888' }}>{formatDateTime(row.waktu)}</span>
      ),
    },
    {
      key: 'user', label: 'Petugas',
      render: (row: LogAktivitas) => (
        <code style={{ fontSize: 12 }}>@{row.user}</code>
      ),
    },
    {
      key: 'tabel', label: 'Kategori',
      render: (row: LogAktivitas) => (
        <span className="badge badge-success">{getCategoryName(row.tabel)}</span>
      ),
    },
    {
      key: 'detail', label: 'Rincian Barang Masuk',
      render: (row: LogAktivitas) => (
        <span style={{ fontSize: 12, fontWeight: 500 }}>{row.detail}</span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Barang Masuk</h1>
          <p className="page-subtitle">Riwayat pencatatan barang dan stock baru yang masuk ke toko</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={loading}
        searchable={true}
      />
    </div>
  );
}
