'use client';

import { useState, useEffect, useMemo } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import {
  getKategoris,
  createKategori,
  updateKategori,
  deleteKategori,
  seedContohKategori,
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { MsKategori, JenisToko } from '@/lib/types';

const SATUAN_OPTIONS = [
  'Pcs',
  'Kg',
  'Gram',
  'Dus',
  'Pack',
  'Bungkus',
  'Lusin',
  'Kodi',
  'Meter',
  'Set',
  'Botol',
  'Kaleng',
  'Tabung',
  'Lainnya',
];

export default function KategoriStockPage() {
  const user = getCurrentUser();
  const [data, setData] = useState<MsKategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterJenis, setFilterJenis] = useState<'semua' | JenisToko>('semua');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MsKategori | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Form State
  const [form, setForm] = useState({
    kode: '',
    nama: '',
    jenis_toko: 'kelontong' as JenisToko,
    satuan_default: 'Pcs',
    keterangan: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const items = await getKategoris();
      setData(items);
    } catch {
      setError('Gagal memuat data kategori stock');
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
      kode: '',
      nama: '',
      jenis_toko: filterJenis !== 'semua' ? filterJenis : 'kelontong',
      satuan_default: filterJenis === 'kelontong' ? 'Pcs' : filterJenis === 'baju' ? 'Pcs' : 'Pcs',
      keterangan: '',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (row: MsKategori) => {
    setEditing(row);
    setForm({
      kode: row.kode,
      nama: row.nama,
      jenis_toko: row.jenis_toko || 'kelontong',
      satuan_default: row.satuan_default || 'Pcs',
      keterangan: row.keterangan || '',
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      setError('Nama kategori tidak boleh kosong');
      return;
    }
    const cleanKode = form.kode.trim().toUpperCase() || form.nama.trim().slice(0, 4).toUpperCase();

    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateKategori(editing.id, {
          kode: cleanKode,
          nama: form.nama.trim(),
          jenis_toko: form.jenis_toko,
          satuan_default: form.satuan_default,
          keterangan: form.keterangan.trim(),
          update_by: user?.username,
        });
      } else {
        await createKategori({
          kode: cleanKode,
          nama: form.nama.trim(),
          jenis_toko: form.jenis_toko,
          satuan_default: form.satuan_default,
          keterangan: form.keterangan.trim(),
          create_by: user?.username,
        });
      }
      await load();
      closeModal();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kategori_updated'));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan kategori');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori stock ini?')) return;
    setDeleting(id);
    try {
      await deleteKategori(id);
      setData(prev => prev.filter(d => d.id !== id));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kategori_updated'));
      }
    } catch {
      alert('Gagal menghapus kategori');
    } finally {
      setDeleting(null);
    }
  };

  const handleSeedPresets = async () => {
    if (!confirm('Muat template kategori standar untuk Toko Kelontong & Baju?')) return;
    setLoading(true);
    try {
      const updated = await seedContohKategori('semua');
      setData(updated);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kategori_updated'));
      }
    } catch {
      alert('Gagal memuat template kategori');
    } finally {
      setLoading(false);
    }
  };

  // Filter Data by Jenis Toko
  const filteredData = useMemo(() => {
    if (filterJenis === 'semua') return data;
    return data.filter(d => d.jenis_toko === filterJenis);
  }, [data, filterJenis]);

  // Counts
  const counts = useMemo(() => {
    const total = data.length;
    const kelontong = data.filter(d => d.jenis_toko === 'kelontong').length;
    const baju = data.filter(d => d.jenis_toko === 'baju').length;
    const umum = data.filter(d => d.jenis_toko === 'umum').length;
    return { total, kelontong, baju, umum };
  }, [data]);

  const columns = [
    {
      key: 'kode',
      label: 'Kode',
      width: '100px',
      render: (row: MsKategori) => (
        <span className="badge badge-gray font-mono font-bold">
          {row.kode}
        </span>
      ),
    },
    {
      key: 'nama',
      label: 'Nama Kategori',
      render: (row: MsKategori) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.nama}</div>
          {row.keterangan && (
            <div style={{ fontSize: 12, color: 'var(--text-muted, #71717a)', marginTop: 2 }}>
              {row.keterangan}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'jenis_toko',
      label: 'Jenis Usaha / Toko',
      width: '180px',
      render: (row: MsKategori) => {
        if (row.jenis_toko === 'kelontong') {
          return <span className="badge badge-success">🏪 Toko Kelontong</span>;
        }
        if (row.jenis_toko === 'baju') {
          return <span className="badge badge-purple">👕 Toko Baju</span>;
        }
        return <span className="badge badge-info">📦 Umum</span>;
      },
    },
    {
      key: 'satuan_default',
      label: 'Satuan Standar',
      width: '130px',
      render: (row: MsKategori) => (
        <span className="badge badge-gray" style={{ fontWeight: 500 }}>
          {row.satuan_default || 'Pcs'}
        </span>
      ),
    },
    {
      key: 'create_time',
      label: 'Dibuat',
      width: '140px',
      render: (row: MsKategori) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted, #71717a)' }}>
          {formatDate(row.create_time)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      width: '110px',
      render: (row: MsKategori) => (
        <div className="table-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => openEdit(row)}
            title="Edit Kategori"
            id={`btn-edit-kategori-${row.id}`}
          >
            ✏️
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(row.id)}
            title="Hapus Kategori"
            disabled={deleting === row.id}
            id={`btn-del-kategori-${row.id}`}
          >
            {deleting === row.id ? (
              <div className="spinner" style={{ width: 12, height: 12 }} />
            ) : (
              '🗑️'
            )}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Master Kategori Stock</h1>
          <p className="page-subtitle">
            Kelola kategori produk dan stok untuk Toko Kelontong, Toko Baju, dan kategori umum
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn-sm ${filterJenis === 'semua' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterJenis('semua')}
          >
            Semua ({counts.total})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterJenis === 'kelontong' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterJenis('kelontong')}
          >
            🏪 Toko Kelontong ({counts.kelontong})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterJenis === 'baju' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterJenis('baju')}
          >
            👕 Toko Baju ({counts.baju})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${filterJenis === 'umum' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterJenis('umum')}
          >
            📦 Umum ({counts.umum})
          </button>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleSeedPresets}
            title="Muat contoh kategori kelontong dan pakaian otomatis"
          >
            💡 Muat Template Kategori
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        onAdd={openAdd}
        addLabel="+ Tambah Kategori"
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Kategori Stock' : 'Tambah Kategori Stock'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal} type="button">
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              id="btn-save-kategori"
              type="button"
            >
              {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : null}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error mb-16">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <div className="form-group">
              <label className="form-label">Jenis Usaha / Toko *</label>
              <select
                className="form-control"
                value={form.jenis_toko}
                onChange={e =>
                  setForm(f => ({ ...f, jenis_toko: e.target.value as JenisToko }))
                }
                id="input-jenis-toko"
                required
              >
                <option value="kelontong">🏪 Toko Kelontong (Sembako, Makanan, Minuman, dll)</option>
                <option value="baju">👕 Toko Baju & Fashion (Kaos, Kemeja, Celana, Gamis, dll)</option>
                <option value="umum">📦 Umum / Keduanya</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Kode Kategori</label>
                <input
                  type="text"
                  className="form-control uppercase"
                  placeholder="Contoh: SMBK"
                  value={form.kode}
                  onChange={e => setForm(f => ({ ...f, kode: e.target.value.toUpperCase() }))}
                  maxLength={10}
                  id="input-kode-kategori"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Kategori *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Contoh: Sembako, Kemeja Pria..."
                  value={form.nama}
                  onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                  autoFocus
                  required
                  id="input-nama-kategori"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Standar (Default Unit)</label>
              <select
                className="form-control"
                value={form.satuan_default}
                onChange={e => setForm(f => ({ ...f, satuan_default: e.target.value }))}
                id="input-satuan-default"
              >
                {SATUAN_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <small style={{ color: 'var(--text-muted, #71717a)', marginTop: 4, display: 'block' }}>
                Misal: Kg untuk beras/gula, Pcs untuk pakaian/snack, Dus untuk minyak goreng kartonan.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Keterangan / Contoh Produk</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Contoh: Beras Rojo Lele, Minyak Bimoli, Gula Gulaku..."
                value={form.keterangan}
                onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
                id="input-keterangan-kategori"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}

