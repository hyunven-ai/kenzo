'use client';

import { useState, useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend, type TooltipItem } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { getDashboardStats, getChartData, getKategoriSales } from '@/lib/db';
import { formatRupiah, formatChartDate, today, daysAgo } from '@/lib/utils';
import type { DashboardStats, ChartDataPoint, KategoriSales } from '@/lib/types';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ErrorState from '@/components/ui/ErrorState';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

const KATEGORI_COLORS: Record<string, string> = {
  HP: '#1565c0',
  'HP Non Pajak': '#00897b',
  Aksesoris: '#8e24aa',
  CCTV: '#00acc1',
  Kuota: '#f57c00',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [kategoriData, setKategoriData] = useState<KategoriSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(today());
  const [tempFrom, setTempFrom] = useState(daysAgo(30));
  const [tempTo, setTempTo] = useState(today());

  const loadData = async (from: string, to: string) => {
    setLoading(true);
    setError('');
    try {
      const [s, c, k] = await Promise.all([
        getDashboardStats(from, to),
        getChartData(from, to),
        getKategoriSales(from, to),
      ]);
      setStats(s);
      setChartData(c);
      setKategoriData(k);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data';
      setError(msg);
      // Fallback demo data
      setStats({
        total_pemasukan: 1181192000,
        total_pengeluaran: 1055509680,
        total_keuntungan: 125682320,
        total_produk: 305,
        total_aset: 391313410,
      });
      setChartData(generateDemoChart());
      setKategoriData([
        { kategori: 'HP', jumlah: 120, total: 900000000 },
        { kategori: 'HP Non Pajak', jumlah: 80, total: 200000000 },
        { kategori: 'Aksesoris', jumlah: 15, total: 30000000 },
        { kategori: 'CCTV', jumlah: 5, total: 51192000 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(fromDate, toDate);
  }, []);

  const handleFilter = () => {
    setFromDate(tempFrom);
    setToDate(tempTo);
    loadData(tempFrom, tempTo);
  };

  const handleReset = () => {
    const f = daysAgo(30);
    const t = today();
    setTempFrom(f);
    setTempTo(t);
    setFromDate(f);
    setToDate(t);
    loadData(f, t);
  };

  const barChartData = {
    labels: chartData.map(d => formatChartDate(d.tanggal)),
    datasets: [
      {
        label: 'Pemasukan',
        data: chartData.map(d => d.pemasukan),
        backgroundColor: '#1565c0',
        borderRadius: 3,
      },
      {
        label: 'Pengeluaran',
        data: chartData.map(d => d.pengeluaran),
        backgroundColor: '#e53935',
        borderRadius: 3,
      },
      {
        label: 'Keuntungan',
        data: chartData.map(d => d.keuntungan),
        backgroundColor: '#2e7d32',
        borderRadius: 3,
      },
    ],
  };

  const donutData = {
    labels: kategoriData.map(k => k.kategori),
    datasets: [
      {
        data: kategoriData.map(k => k.total),
        backgroundColor: kategoriData.map(k => KATEGORI_COLORS[k.kategori] ?? '#9e9e9e'),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const, labels: { font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) =>
            `${ctx.dataset.label ?? ''}: ${formatRupiah(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v: unknown) => {
            const n = Number(v);
            if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'Jt';
            return String(n);
          },
          font: { size: 10 },
        },
        grid: { color: '#f0f0f0' },
      },
      x: { ticks: { font: { size: 10 } }, grid: { display: false } },
    },
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { font: { size: 11 }, padding: 12 },
      },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) =>
            `${ctx.label}: ${formatRupiah(ctx.parsed)}`,
        },
      },
    },
    cutout: '65%',
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Summary</h1>
        </div>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#2e7d32" style={{ cursor: 'pointer' }}>
          <path d="M4.5 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM14.25 8.625a3.375 3.375 0 1 1 6.75 0 3.375 3.375 0 0 1-6.75 0ZM1.5 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM17.25 19.128l-.001.144a2.25 2.25 0 0 1-.233.96 10.088 10.088 0 0 0 5.06-1.01.75.75 0 0 0 .42-.643 4.875 4.875 0 0 0-6.957-4.611 8.586 8.586 0 0 1 1.71 5.157v.003Z" />
        </svg>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="form-group">
          <label className="form-label">Tanggal Dari</label>
          <input
            type="date"
            className="form-control"
            value={tempFrom}
            onChange={e => setTempFrom(e.target.value)}
            id="filter-from"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Tanggal Sampai</label>
          <input
            type="date"
            className="form-control"
            value={tempTo}
            onChange={e => setTempTo(e.target.value)}
            id="filter-to"
          />
        </div>
        <div className="filter-bar-right" style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleReset} id="btn-reset">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset
          </button>
          <button className="btn btn-primary" onClick={handleFilter} id="btn-filter" disabled={loading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            Filter
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState
            title="Kendala Memuat Ringkasan"
            message={error}
            cause="Gagal mengambil statistik dari server database."
            solution="Periksa koneksi internet Anda atau klik Coba Lagi untuk memuat ulang data terbaru."
            onRetry={() => loadData(fromDate, toDate)}
            retryLabel="Muat Ulang"
            compact
          />
        </div>
      )}

      {/* Metric Cards Row 1 */}
      <div className="metric-cards-grid">
        <div className="metric-card metric-card-blue">
          <div className="metric-card-label">Total Pemasukan</div>
          <div className="metric-card-value">
            {loading ? <Skeleton width="140px" height="28px" borderRadius="4px" /> : formatRupiah(stats?.total_pemasukan ?? 0)}
          </div>
        </div>
        <div className="metric-card metric-card-red">
          <div className="metric-card-label">Total Pengeluaran</div>
          <div className="metric-card-value">
            {loading ? <Skeleton width="140px" height="28px" borderRadius="4px" /> : formatRupiah(stats?.total_pengeluaran ?? 0)}
          </div>
        </div>
        <div className="metric-card metric-card-green">
          <div className="metric-card-label">Total Keuntungan</div>
          <div className="metric-card-value">
            {loading ? <Skeleton width="140px" height="28px" borderRadius="4px" /> : formatRupiah(stats?.total_keuntungan ?? 0)}
          </div>
        </div>
      </div>

      {/* Metric Cards Row 2 */}
      <div className="metric-cards-grid-2">
        <div className="metric-card metric-card-yellow">
          <div className="metric-card-label">Total Product</div>
          <div className="metric-card-value" style={{ fontSize: 28 }}>
            {loading ? <Skeleton width="90px" height="28px" borderRadius="4px" /> : (stats?.total_produk ?? 0).toLocaleString('id-ID')}
          </div>
        </div>
        <div className="metric-card metric-card-teal">
          <div className="metric-card-label">Total Aset</div>
          <div className="metric-card-value">
            {loading ? <Skeleton width="140px" height="28px" borderRadius="4px" /> : formatRupiah(stats?.total_aset ?? 0)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <div className="chart-title">Pemasukan vs Penjualan</div>
          <div style={{ height: 260 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', justifyContent: 'flex-end', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, height: '180px', width: '100%' }}>
                  {['60%', '85%', '40%', '95%', '70%', '50%', '80%'].map((h, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', gap: 4, height: '100%', alignItems: 'flex-end' }}>
                      <Skeleton width="50%" height={h} borderRadius="4px" />
                      <Skeleton width="50%" height={`calc(${h} * 0.7)`} borderRadius="4px" />
                    </div>
                  ))}
                </div>
                <Skeleton width="100%" height="16px" />
              </div>
            ) : (
              <Bar data={barChartData} options={barOptions} />
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-title">Penjualan Per Kategori</div>
          <div style={{ height: 260 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ width: 140, height: 140, borderRadius: '50%', border: '16px solid var(--skeleton-bg)', borderTopColor: 'var(--skeleton-shimmer)', animation: 'skeleton-shimmer 1.5s infinite' }} />
              </div>
            ) : kategoriData.length > 0 ? (
              <Doughnut data={donutData} options={donutOptions} />
            ) : (
              <EmptyState
                icon="📊"
                title="Belum Ada Transaksi"
                description="Belum ada transaksi penjualan pada rentang tanggal ini. Silakan ubah filter tanggal."
                compact
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Demo chart data generator
function generateDemoChart(): ChartDataPoint[] {
  const data: ChartDataPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const base = Math.random() * 40_000_000 + 10_000_000;
    const pen = base * (0.85 + Math.random() * 0.1);
    data.push({
      tanggal: d.toISOString().substring(0, 10),
      pemasukan: Math.round(base),
      pengeluaran: Math.round(pen),
      keuntungan: Math.round(base - pen),
    });
  }
  return data;
}
