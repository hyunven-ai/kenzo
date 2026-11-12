'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Trophy,
  TrendingUp,
  Package,
  DollarSign,
  AlertTriangle,
  Download,
  Printer,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
  ShoppingBag,
} from 'lucide-react';
import { getBestSellingProducts, getKategoris } from '@/lib/db';
import { formatRupiah, today } from '@/lib/utils';
import { getCurrentUser } from '@/lib/auth';
import type { BestSellingProduct, BestSellingSummary, MsKategori } from '@/lib/types';
import DateRangeToggle, { computePresetRange, DatePresetKey } from '@/components/ui/DateRangeToggle';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const KATEGORI_COLORS: Record<string, string> = {
  HP: '#1565c0',
  'HP Non Pajak': '#00897b',
  Aksesoris: '#8e24aa',
  CCTV: '#00acc1',
  Kuota: '#f57c00',
  Sparepart: '#e53935',
  Sembako: '#43a047',
  'Makanan & Snack': '#fb8c00',
  Minuman: '#039be5',
  Rokok: '#6d4c41',
  'Kaos & T-Shirt': '#5e35b1',
  Kemeja: '#3949ab',
  Celana: '#1e88e5',
  Lainnya: '#78909c',
};

function getCategoryColor(kategori: string, index: number): string {
  if (KATEGORI_COLORS[kategori]) return KATEGORI_COLORS[kategori];
  const palette = ['#1565c0', '#00897b', '#8e24aa', '#f57c00', '#e53935', '#43a047', '#00acc1', '#5e35b1'];
  return palette[index % palette.length];
}

export default function BestSellingProductPage() {
  const user = getCurrentUser();
  const isSuperAdmin = user?.role === 'super_admin';

  // Default preset: 1 Bulan
  const defaultRange = computePresetRange('1_bulan');
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [tempFrom, setTempFrom] = useState(defaultRange.from);
  const [tempTo, setTempTo] = useState(defaultRange.to);

  const [kategoriFilter, setKategoriFilter] = useState('semua');
  const [categories, setCategories] = useState<MsKategori[]>([]);
  const [sortBy, setSortBy] = useState<'qty' | 'omset' | 'profit'>('qty');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<BestSellingProduct[]>([]);
  const [summary, setSummary] = useState<BestSellingSummary | null>(null);

  // Load categories
  useEffect(() => {
    getKategoris()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Fetch data
  const loadData = useCallback(async (from: string, to: string, kat: string) => {
    setLoading(true);
    try {
      const res = await getBestSellingProducts(from, to, kat);
      setProducts(res.data);
      setSummary(res.summary);
    } catch (err) {
      console.error('Failed to load best selling products:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(fromDate, toDate, kategoriFilter);
  }, [fromDate, toDate, kategoriFilter, loadData]);

  const handlePresetSelect = (from: string, to: string) => {
    setTempFrom(from);
    setTempTo(to);
    setFromDate(from);
    setToDate(to);
  };

  const handleApplyCustomFilter = () => {
    setFromDate(tempFrom);
    setToDate(tempTo);
  };

  // Filtered & Sorted products for table
  const sortedAndFilteredProducts = useMemo(() => {
    let list = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        p =>
          p.nama_barang.toLowerCase().includes(q) ||
          p.kategori.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'omset') return b.total_omset - a.total_omset;
      if (sortBy === 'profit') return b.total_profit - a.total_profit;
      return b.total_qty_terjual - a.total_qty_terjual;
    });

    return list;
  }, [products, searchQuery, sortBy]);

  // Restock alerts: Check Top 10 items for low/out-of-stock
  const criticalRestockItems = useMemo(() => {
    return products.slice(0, 10).filter(p => p.status_stok === 'habis' || p.status_stok === 'menipis');
  }, [products]);

  // Chart 1: Top 10 Bar Chart
  const top10BarData = useMemo(() => {
    const top10 = products.slice(0, 10);
    const labels = top10.map(p =>
      p.nama_barang.length > 20 ? p.nama_barang.slice(0, 18) + '...' : p.nama_barang
    );

    return {
      labels,
      datasets: [
        {
          label: sortBy === 'omset' ? 'Omset Penjualan (Rp)' : 'Unit Terjual (Qty)',
          data: top10.map(p => (sortBy === 'omset' ? p.total_omset : p.total_qty_terjual)),
          backgroundColor: '#3b82f6',
          borderRadius: 4,
        },
      ],
    };
  }, [products, sortBy]);

  // Chart 2: Category distribution Donut
  const categoryChartData = useMemo(() => {
    const katMap = new Map<string, number>();
    products.forEach(p => {
      const current = katMap.get(p.kategori) || 0;
      katMap.set(p.kategori, current + (sortBy === 'omset' ? p.total_omset : p.total_qty_terjual));
    });

    const labels = Array.from(katMap.keys());
    const data = Array.from(katMap.values());
    const backgroundColor = labels.map((kat, idx) => getCategoryColor(kat, idx));

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderWidth: 2,
          borderColor: '#1e293b',
        },
      ],
    };
  }, [products, sortBy]);

  // Export to CSV
  const handleExportCsv = () => {
    if (products.length === 0) {
      alert('Tidak ada data produk untuk diekspor.');
      return;
    }

    const headers = [
      'Peringkat',
      'Nama Barang',
      'Kategori',
      'Barcode/Kode',
      'Unit Terjual',
      'Total Omset (Rp)',
      'Total Modal (Rp)',
      'Profit (Rp)',
      'Margin (%)',
      'Kontribusi Omset (%)',
      'Sisa Stok',
      'Status Stok',
    ];

    const rows = sortedAndFilteredProducts.map((p, idx) => [
      idx + 1,
      `"${p.nama_barang.replace(/"/g, '""')}"`,
      `"${p.kategori}"`,
      `"${p.barcode || '-'}"`,
      p.total_qty_terjual,
      p.total_omset,
      p.total_modal,
      p.total_profit,
      p.margin_persen,
      p.kontribusi_persen,
      p.sisa_stok,
      p.status_stok === 'habis' ? 'Habis' : p.status_stok === 'menipis' ? 'Menipis' : 'Aman',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `produk_terlaris_${fromDate}_sd_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Max Qty for visual progress bar
  const maxSoldQty = products[0]?.total_qty_terjual || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      {/* Header Bar */}
      <div
        className="card no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          padding: '16px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
            }}
          >
            <Trophy size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Produk Terlaris (Best Selling)
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
              Analisis ranking produk laku, kontribusi pendapatan, margin profit, dan alarm stok.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadData(fromDate, toDate, kategoriFilter)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Filter Section Card */}
      <div
        className="card no-print"
        style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} style={{ color: '#3b82f6' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
              Periode Penjualan:
            </span>
          </div>

          {/* Preset Buttons */}
          <DateRangeToggle
            currentFrom={fromDate}
            currentTo={toDate}
            onSelect={handlePresetSelect}
          />
        </div>

        {/* Custom Date + Category Filter Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--border-light, #2a2a32)',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Dari Tanggal
            </label>
            <input
              type="date"
              className="form-control"
              value={tempFrom}
              onChange={e => setTempFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Sampai Tanggal
            </label>
            <input
              type="date"
              className="form-control"
              value={tempTo}
              onChange={e => setTempTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Filter Kategori
            </label>
            <select
              className="form-control"
              value={kategoriFilter}
              onChange={e => setKategoriFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="semua">Semua Kategori</option>
              {categories.map(k => (
                <option key={k.id} value={k.nama}>
                  {k.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleApplyCustomFilter}
              style={{ width: '100%', height: 38, fontWeight: 600 }}
            >
              Terapkan Periode
            </button>
          </div>
        </div>
      </div>

      {/* Restock Warning Banner (If Top 10 items are low or out of stock) */}
      {criticalRestockItems.length > 0 && (
        <div
          className="no-print"
          style={{
            background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.1))',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#ef4444',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f87171' }}>
                Peringatan Restock Produk Unggulan!
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                Terdapat <strong>{criticalRestockItems.length} produk terlaris</strong> yang stoknya sedang{' '}
                <span style={{ color: '#ef4444', fontWeight: 700 }}>Habis (0 pcs)</span> atau{' '}
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>Menipis (≤ 5 pcs)</span>. Segera lakukan
                pemesanan ulang ke supplier agar tidak kehilangan potensi penjualan.
              </div>
            </div>
          </div>

          <Link
            href="/transaksi/pembelian"
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap' }}
          >
            Buat Pembelian / Restock →
          </Link>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 16,
        }}
      >
        {/* KPI 1: Total Unit Terjual */}
        <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total Unit Terjual
              </span>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                {loading ? <Skeleton style={{ width: 100, height: 28 }} /> : `${(summary?.total_unit_terjual || 0).toLocaleString('id-ID')} Pcs`}
              </div>
              <div style={{ fontSize: 11.5, color: '#3b82f6', marginTop: 4, fontWeight: 600 }}>
                dari {summary?.total_produk_laku || 0} jenis produk laku
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Package size={22} />
            </div>
          </div>
        </div>

        {/* KPI 2: Total Omset */}
        <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total Omset Penjualan
              </span>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 4 }}>
                {loading ? <Skeleton style={{ width: 140, height: 28 }} /> : formatRupiah(summary?.total_omset || 0)}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                Pendapatan kotor produk laku
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <DollarSign size={22} />
            </div>
          </div>
        </div>

        {/* KPI 3: Estimasi Profit (Khusus Super Admin) */}
        {isSuperAdmin && (
          <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Estimasi Keuntungan Kotor
                </span>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', marginTop: 4 }}>
                  {loading ? <Skeleton style={{ width: 130, height: 28 }} /> : formatRupiah(summary?.total_profit || 0)}
                </div>
                <div style={{ fontSize: 11.5, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                  Margin: +{summary?.rata_margin_persen || 0}%
                </div>
              </div>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TrendingUp size={22} />
              </div>
            </div>
          </div>
        )}

        {/* KPI 4: Produk Juara #1 */}
        <div className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ maxWidth: '80%' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                🥇 Juara #1 Terlaris
              </span>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={summary?.top_product_name}
              >
                {loading ? <Skeleton style={{ width: 150, height: 24 }} /> : summary?.top_product_name || '-'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 4 }}>
                Terjual <strong>{summary?.top_product_qty || 0} unit</strong> ({summary?.top_product_kontribusi || 0}% omset)
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#eab308',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trophy size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {/* Chart 1: Bar Chart Top 10 */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                📊 Top 10 Produk Terlaris
              </span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
                Berdasarkan {sortBy === 'omset' ? 'Total Omset (Rp)' : 'Kuantiti Terjual (Unit)'}
              </p>
            </div>
          </div>

          <div style={{ height: 260, position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Skeleton style={{ width: '100%', height: '100%' }} />
              </div>
            ) : products.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
                Belum ada data penjualan pada periode ini.
              </div>
            ) : (
              <Bar
                data={top10BarData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: ctx =>
                          sortBy === 'omset'
                            ? ` Omset: ${formatRupiah(ctx.parsed.y ?? 0)}`
                            : ` Terjual: ${ctx.parsed.y ?? 0} Pcs`,
                      },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { color: '#94a3b8', font: { size: 10 } },
                      grid: { display: false },
                    },
                    y: {
                      ticks: {
                        color: '#94a3b8',
                        font: { size: 10 },
                        callback: val => (sortBy === 'omset' ? `${Number(val) / 1000}k` : val),
                      },
                      grid: { color: 'rgba(148, 163, 184, 0.1)' },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>

        {/* Chart 2: Category Doughnut */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                🍩 Distribusi Kategori Terlaris
              </span>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
                Porsi kontribusi kategori pada produk laku
              </p>
            </div>
          </div>

          <div style={{ height: 260, position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Skeleton style={{ width: '100%', height: '100%' }} />
              </div>
            ) : products.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', fontSize: 13 }}>
                Belum ada data kategori.
              </div>
            ) : (
              <Doughnut
                data={categoryChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'right',
                      labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 },
                    },
                  },
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Ranking Table Section */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Table Controls Header */}
        <div
          className="no-print"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-light, #2a2a32)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              📋 Tabel Ranking Produk Laku
            </span>
            <span className="badge badge-info" style={{ fontSize: 11 }}>
              {sortedAndFilteredProducts.length} Produk
            </span>
          </div>

          {/* Search & Sort Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                placeholder="Cari nama barang / kode..."
                className="form-control"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 32, height: 36, fontSize: 12.5 }}
              />
            </div>

            {/* Sorting Switch Buttons */}
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-elevated, #24242c)',
                padding: 3,
                borderRadius: 8,
                border: '1px solid var(--border-light, #2e2e36)',
              }}
            >
              <button
                type="button"
                onClick={() => setSortBy('qty')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: sortBy === 'qty' ? '#3b82f6' : 'transparent',
                  color: sortBy === 'qty' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Paling Banyak (Qty)
              </button>

              <button
                type="button"
                onClick={() => setSortBy('omset')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: sortBy === 'omset' ? '#10b981' : 'transparent',
                  color: sortBy === 'omset' ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease',
                }}
              >
                Omset Tertinggi
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setSortBy('profit')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 6,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: sortBy === 'profit' ? '#f59e0b' : 'transparent',
                    color: sortBy === 'profit' ? '#ffffff' : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Profit Tertinggi
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Print Header (Only visible in Print) */}
        <div className="print-only" style={{ display: 'none', padding: 20, textAlign: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 'bold', margin: 0 }}>LAPORAN PRODUK TERLARIS (BEST SELLING)</h2>
          <p style={{ fontSize: 12, margin: '4px 0' }}>
            Periode: {fromDate} s/d {toDate} | Kategori: {kategoriFilter === 'semua' ? 'Semua Kategori' : kategoriFilter}
          </p>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} style={{ height: 44, width: '100%', borderRadius: 6 }} />
            ))}
          </div>
        ) : sortedAndFilteredProducts.length === 0 ? (
          <div style={{ padding: 40 }}>
            <EmptyState
              title="Tidak ada produk laku ditemukan"
              description="Belum ada transaksi penjualan produk untuk rentang tanggal dan kategori ini."
            />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-light, #2e2e36)', background: 'var(--bg-elevated, #24242c)' }}>
                  <th style={{ width: 70, textAlign: 'center', padding: '12px 14px' }}>Rank</th>
                  <th style={{ minWidth: 220, padding: '12px 14px' }}>Nama Produk</th>
                  <th style={{ width: 130, padding: '12px 14px' }}>Kategori</th>
                  <th style={{ width: 150, padding: '12px 14px' }}>Unit Terjual</th>
                  <th style={{ width: 150, padding: '12px 14px', textAlign: 'right' }}>Total Omset</th>
                  {isSuperAdmin && (
                    <th style={{ width: 150, padding: '12px 14px', textAlign: 'right' }}>Estimasi Profit</th>
                  )}
                  <th style={{ width: 120, padding: '12px 14px', textAlign: 'center' }}>Kontribusi</th>
                  <th style={{ width: 140, padding: '12px 14px', textAlign: 'center' }}>Status Sisa Stok</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredProducts.map((p, idx) => {
                  const rank = idx + 1;
                  const volumePercent = maxSoldQty > 0 ? (p.total_qty_terjual / maxSoldQty) * 100 : 0;

                  return (
                    <tr
                      key={`${p.nama_barang}-${p.kategori}-${idx}`}
                      style={{
                        borderBottom: '1px solid var(--border-light, #22222a)',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Rank Badge */}
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                        {rank === 1 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: '#fbbf24',
                              color: '#78350f',
                              fontWeight: 800,
                              fontSize: 13,
                              boxShadow: '0 2px 6px rgba(251, 191, 36, 0.4)',
                            }}
                          >
                            1
                          </span>
                        ) : rank === 2 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: '#cbd5e1',
                              color: '#334155',
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            2
                          </span>
                        ) : rank === 3 ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: '#f97316',
                              color: '#fff',
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            3
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                            #{rank}
                          </span>
                        )}
                      </td>

                      {/* Product Name & Barcode */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13.5 }}>
                          {p.nama_barang}
                        </div>
                        {p.barcode && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, fontFamily: 'monospace' }}>
                            🏷️ {p.barcode}
                          </div>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td style={{ padding: '12px 14px' }}>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {p.kategori}
                        </span>
                      </td>

                      {/* Qty Sold + Progress Bar */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-primary)' }}>
                          <span>{p.total_qty_terjual} Pcs</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                            ({p.jumlah_transaksi}x trs)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: 5,
                            background: 'rgba(255,255,255,0.08)',
                            borderRadius: 3,
                            marginTop: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(volumePercent, 4)}%`,
                              height: '100%',
                              background: rank <= 3 ? '#eab308' : '#3b82f6',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </td>

                      {/* Total Omset */}
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: '#10b981', fontSize: 13 }}>
                        {formatRupiah(p.total_omset)}
                      </td>

                      {/* Profit & Margin % (Super Admin) */}
                      {isSuperAdmin && (
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#f59e0b', fontSize: 13 }}>
                            {formatRupiah(p.total_profit)}
                          </div>
                          <div style={{ fontSize: 11, color: '#10b981', marginTop: 1, fontWeight: 600 }}>
                            +{p.margin_persen}%
                          </div>
                        </td>
                      )}

                      {/* Contribution % */}
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                        <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', fontSize: 11, fontWeight: 700 }}>
                          {p.kontribusi_persen}%
                        </span>
                      </td>

                      {/* Stock Status & Remaining Qty */}
                      <td style={{ textAlign: 'center', padding: '12px 14px' }}>
                        {p.status_stok === 'habis' ? (
                          <span
                            className="badge badge-error"
                            style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Stok kosong! Segera lakukan restock."
                          >
                            🔴 Habis (0)
                          </span>
                        ) : p.status_stok === 'menipis' ? (
                          <span
                            className="badge"
                            style={{
                              fontSize: 11,
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: '#fbbf24',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Stok menipis! Siapkan order ulang."
                          >
                            🟡 Sisa {p.sisa_stok}
                          </span>
                        ) : (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            🟢 {p.sisa_stok} Pcs
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

