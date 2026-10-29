'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { getGaransi, createGaransi, updateGaransi, deleteGaransi } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { MsGaransi } from '@/lib/types';

function calculateRemainingWarranty(purchaseDateStr: string, durationStr: string): { text: string; isExpired: boolean; badgeClass: string } {
  if (durationStr === 'Lifetime') {
    return { text: 'Seumur Hidup', isExpired: false, badgeClass: 'badge-purple' };
  }

  const purchaseDate = new Date(purchaseDateStr);
  if (isNaN(purchaseDate.getTime())) {
    return { text: '-', isExpired: false, badgeClass: 'badge-gray' };
  }

  const match = durationStr.match(/(\d+)\s*(Bulan|Tahun|Hari)/i);
  if (!match) {
    return { text: '-', isExpired: false, badgeClass: 'badge-gray' };
  }

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  const expiryDate = new Date(purchaseDate);
  if (unit === 'tahun') {
    expiryDate.setFullYear(expiryDate.getFullYear() + value);
  } else if (unit === 'bulan') {
    expiryDate.setMonth(expiryDate.getMonth() + value);
  } else if (unit === 'hari') {
    expiryDate.setDate(expiryDate.getDate() + value);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  if (diffTime < 0) {
    return { text: 'Habis', isExpired: true, badgeClass: 'badge-danger' };
  }

  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays >= 365) {
    const years = Math.floor(diffDays / 365);
    const remainingDays = diffDays % 365;
    const months = Math.floor(remainingDays / 30);
    return {
      text: `${years} Thn${months > 0 ? ` ${months} Bln` : ''}`,
      isExpired: false,
      badgeClass: 'badge-success',
    };
  }

  if (diffDays >= 30) {
    const months = Math.floor(diffDays / 30);
    const days = diffDays % 30;
    return {
      text: `${months} Bln${days > 0 ? ` ${days} Hr` : ''}`,
      isExpired: false,
      badgeClass: 'badge-info',
    };
  }

  return { text: `${diffDays} Hari`, isExpired: false, badgeClass: 'badge-warning' };
}

export default function GaransiPage() {
  const user = getCurrentUser();
  const [data, setData] = useState<MsGaransi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MsGaransi | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Form State
  const [form, setForm] = useState({
    id_transaksi: '',
    nama_pelanggan: '',
    nomor_whatsapp: '',
    imei1: '',
    imei2: '',
    nomor_seri: '',
    merk_tipe: '',
    warna_kapasitas: '',
    tanggal_pembelian: new Date().toISOString().split('T')[0],
    durasi_garansi: '1 Tahun',
    jenis_garansi: 'Resmi',
    status_garansi: 'Aktif',
  });

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    id_transaksi: true,
    nama_pelanggan: true,
    nomor_whatsapp: true,
    imei: true,
    nomor_seri: true,
    merk_tipe: true,
    warna_kapasitas: true,
    tanggal_pembelian: true,
    durasi_garansi: true,
    sisa_garansi: true,
    jenis_garansi: true,
    status_garansi: true,
  });
  const [showColDropdown, setShowColDropdown] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getGaransi();
      setData(Array.isArray(result) ? result : []);
    } catch {
      setError('Gagal memuat data garansi');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      id_transaksi: '',
      nama_pelanggan: '',
      nomor_whatsapp: '',
      imei1: '',
      imei2: '',
      nomor_seri: '',
      merk_tipe: '',
      warna_kapasitas: '',
      tanggal_pembelian: new Date().toISOString().split('T')[0],
      durasi_garansi: '1 Tahun',
      jenis_garansi: 'Resmi',
      status_garansi: 'Aktif',
    });
    setModalOpen(true);
  };

  const openEdit = (row: MsGaransi) => {
    setEditing(row);
    setForm({
      id_transaksi: row.id_transaksi,
      nama_pelanggan: row.nama_pelanggan,
      nomor_whatsapp: row.nomor_whatsapp,
      imei1: row.imei1 || '',
      imei2: row.imei2 || '',
      nomor_seri: row.nomor_seri || '',
      merk_tipe: row.merk_tipe,
      warna_kapasitas: row.warna_kapasitas || '',
      tanggal_pembelian: new Date(row.tanggal_pembelian).toISOString().split('T')[0],
      durasi_garansi: row.durasi_garansi,
      jenis_garansi: row.jenis_garansi,
      status_garansi: row.status_garansi,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id_transaksi.trim() || !form.nama_pelanggan.trim() || !form.nomor_whatsapp.trim() || !form.merk_tipe.trim()) {
      setError('Harap isi semua kolom wajib (*)');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateGaransi(editing.id, { ...form, update_by: user?.username });
      } else {
        await createGaransi({ ...form, create_by: user?.username });
      }
      await load();
      closeModal();
    } catch (e: any) {
      setError(e?.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data garansi ini?')) return;
    setDeleting(id);
    try {
      await deleteGaransi(id);
      setData(prev => prev.filter(d => d.id !== id));
    } catch {
      alert('Gagal menghapus data');
    } finally {
      setDeleting(null);
    }
  };

  // Custom client-side filter
  const filteredData = (data || []).filter((item) => {
    if (search) {
      const q = search.toLowerCase();
      const matchesIdTransaksi = item.id_transaksi?.toLowerCase().includes(q);
      const matchesImei = (item.imei1?.toLowerCase().includes(q) || item.imei2?.toLowerCase().includes(q));
      const matchesNama = item.nama_pelanggan?.toLowerCase().includes(q);
      const matchesSeri = item.nomor_seri?.toLowerCase().includes(q);
      return matchesIdTransaksi || matchesImei || matchesNama || matchesSeri;
    }
    return true;
  });

  const columns = [
    {
      key: 'id_transaksi',
      label: 'ID Transaksi',
      render: (row: MsGaransi) => <code style={{ fontSize: 12, fontWeight: 600 }}>{row.id_transaksi}</code>,
    },
    {
      key: 'nama_pelanggan',
      label: 'Nama Pelanggan',
      render: (row: MsGaransi) => <strong>{row.nama_pelanggan}</strong>,
    },
    {
      key: 'nomor_whatsapp',
      label: 'No. WhatsApp',
      render: (row: MsGaransi) => (
        <a 
          href={`https://wa.me/${row.nomor_whatsapp.replace(/[^0-9]/g, '')}`} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: '#25D366', textDecoration: 'none', fontWeight: 500 }}
        >
          💬 {row.nomor_whatsapp}
        </a>
      ),
    },
    {
      key: 'imei',
      label: 'IMEI 1 & 2',
      render: (row: MsGaransi) => (
        <div style={{ fontSize: 11, lineHeight: 1.3 }}>
          <div>IMEI 1: <code>{row.imei1 || '-'}</code></div>
          {row.imei2 && <div>IMEI 2: <code>{row.imei2}</code></div>}
        </div>
      ),
    },
    {
      key: 'nomor_seri',
      label: 'No. Seri',
      render: (row: MsGaransi) => <code>{row.nomor_seri || '-'}</code>,
    },
    {
      key: 'merk_tipe',
      label: 'Merk & Tipe HP',
      render: (row: MsGaransi) => <span>{row.merk_tipe}</span>,
    },
    {
      key: 'warna_kapasitas',
      label: 'Warna & RAM/ROM',
      render: (row: MsGaransi) => <span style={{ fontSize: 12 }}>{row.warna_kapasitas || '-'}</span>,
    },
    {
      key: 'tanggal_pembelian',
      label: 'Tgl Pembelian',
      render: (row: MsGaransi) => formatDate(row.tanggal_pembelian),
    },
    {
      key: 'durasi_garansi',
      label: 'Durasi',
      render: (row: MsGaransi) => <span className="badge badge-gray">{row.durasi_garansi}</span>,
    },
    {
      key: 'sisa_garansi',
      label: 'Sisa Garansi',
      render: (row: MsGaransi) => {
        const remaining = calculateRemainingWarranty(row.tanggal_pembelian, row.durasi_garansi);
        return (
          <span className={`badge ${remaining.badgeClass}`}>
            {remaining.text}
          </span>
        );
      },
    },
    {
      key: 'jenis_garansi',
      label: 'Jenis Garansi',
      render: (row: MsGaransi) => (
        <span className={`badge ${
          row.jenis_garansi === 'Resmi' ? 'badge-purple' :
          row.jenis_garansi === 'Toko' ? 'badge-success' : 'badge-info'
        }`}>
          {row.jenis_garansi}
        </span>
      ),
    },
    {
      key: 'status_garansi',
      label: 'Status',
      render: (row: MsGaransi) => (
        <span className={`badge ${
          row.status_garansi === 'Aktif' ? 'badge-success' :
          row.status_garansi === 'Expired' ? 'badge-danger' : 'badge-warning'
        }`}>
          {row.status_garansi}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      width: '120px',
      render: (row: MsGaransi) => (
        <div className="table-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => openEdit(row)}
            title="Edit"
            id={`btn-edit-${row.id}`}
          >
            ✏️
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(row.id)}
            title="Hapus"
            disabled={deleting === row.id}
            id={`btn-del-${row.id}`}
          >
            {deleting === row.id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : '🗑️'}
          </button>
        </div>
      ),
    },
  ];

  // Filter columns based on user preferences
  const activeColumns = columns.filter(col => col.key === 'actions' || (visibleColumns[col.key] ?? true));

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Garansi Barang / HP</h1>
          <p className="page-subtitle">Pendataan dan tracking masa berlaku garansi ponsel pelanggan</p>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="form-group" style={{ minWidth: 320, maxWidth: 450, margin: 0 }}>
          <input
            type="text"
            className="form-control"
            placeholder="Cari ID Transaksi, IMEI, Pelanggan, atau No. Seri..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Column Visibility Configuration Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowColDropdown(!showColDropdown)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              id="btn-toggle-cols"
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
                  background: 'var(--bg-card, #fff)',
                  border: '1px solid var(--border-light, #eee)',
                  borderRadius: 6,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  padding: 12,
                  zIndex: 100,
                  minWidth: 180,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginTop: 6
                }}>
                  <div style={{ fontWeight: 600, fontSize: 11, color: '#666', borderBottom: '1px solid #eee', paddingBottom: 6 }}>
                    Tampilkan Kolom
                  </div>
                  {Object.entries({
                    id_transaksi: 'ID Transaksi',
                    nama_pelanggan: 'Pelanggan',
                    nomor_whatsapp: 'No. WhatsApp',
                    imei: 'IMEI 1 & 2',
                    nomor_seri: 'No. Seri',
                    merk_tipe: 'Merk & Tipe HP',
                    warna_kapasitas: 'Warna & RAM/ROM',
                    tanggal_pembelian: 'Tgl Pembelian',
                    durasi_garansi: 'Durasi',
                    sisa_garansi: 'Sisa Garansi',
                    jenis_garansi: 'Jenis Garansi',
                    status_garansi: 'Status Garansi',
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

          <button className="btn btn-primary" onClick={openAdd} id="btn-add-garansi">
            ➕ Tambah Data Garansi
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="card">
        <DataTable
          data={filteredData}
          columns={activeColumns}
          loading={loading}
          searchable={false} // We handle search locally with the specific search bar above
        />
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Ubah Data Garansi' : 'Tambah Data Garansi'}
        size="lg"
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="alert alert-danger" style={{ padding: 10, borderRadius: 6, fontSize: 13, color: '#721c24', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb' }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">ID Transaksi *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.id_transaksi}
                onChange={(e) => setForm({ ...form, id_transaksi: e.target.value })}
                placeholder="TRX-XXXXXX"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nama Pelanggan *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.nama_pelanggan}
                onChange={(e) => setForm({ ...form, nama_pelanggan: e.target.value })}
                placeholder="Nama Lengkap"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nomor WhatsApp *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.nomor_whatsapp}
                onChange={(e) => setForm({ ...form, nomor_whatsapp: e.target.value })}
                placeholder="Contoh: 08123456789"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Merk & Tipe HP *</label>
              <input
                type="text"
                className="form-control"
                required
                value={form.merk_tipe}
                onChange={(e) => setForm({ ...form, merk_tipe: e.target.value })}
                placeholder="Contoh: Samsung S24 Ultra"
              />
            </div>

            <div className="form-group">
              <label className="form-label">IMEI 1</label>
              <input
                type="text"
                className="form-control"
                value={form.imei1}
                onChange={(e) => setForm({ ...form, imei1: e.target.value })}
                placeholder="IMEI 1 (15 digit)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">IMEI 2</label>
              <input
                type="text"
                className="form-control"
                value={form.imei2}
                onChange={(e) => setForm({ ...form, imei2: e.target.value })}
                placeholder="IMEI 2 (15 digit)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nomor Seri</label>
              <input
                type="text"
                className="form-control"
                value={form.nomor_seri}
                onChange={(e) => setForm({ ...form, nomor_seri: e.target.value })}
                placeholder="Serial Number (S/N)"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Warna & RAM/ROM</label>
              <input
                type="text"
                className="form-control"
                value={form.warna_kapasitas}
                onChange={(e) => setForm({ ...form, warna_kapasitas: e.target.value })}
                placeholder="Contoh: Hitam / 12GB+512GB"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Pembelian *</label>
              <input
                type="date"
                className="form-control"
                required
                value={form.tanggal_pembelian}
                onChange={(e) => setForm({ ...form, tanggal_pembelian: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Durasi Garansi</label>
              <select
                className="form-control"
                value={form.durasi_garansi}
                onChange={(e) => setForm({ ...form, durasi_garansi: e.target.value })}
              >
                <option value="1 Bulan">1 Bulan</option>
                <option value="3 Bulan">3 Bulan</option>
                <option value="6 Bulan">6 Bulan</option>
                <option value="1 Tahun">1 Tahun</option>
                <option value="2 Tahun">2 Tahun</option>
                <option value="Lifetime">Lifetime (Seumur Hidup)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Jenis Garansi</label>
              <select
                className="form-control"
                value={form.jenis_garansi}
                onChange={(e) => setForm({ ...form, jenis_garansi: e.target.value })}
              >
                <option value="Resmi">Resmi</option>
                <option value="Toko">Toko</option>
                <option value="Distributor">Distributor</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Status Garansi</label>
              <select
                className="form-control"
                value={form.status_garansi}
                onChange={(e) => setForm({ ...form, status_garansi: e.target.value })}
              >
                <option value="Aktif">Aktif</option>
                <option value="Expired">Expired</option>
                <option value="Klaim">Klaim</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
