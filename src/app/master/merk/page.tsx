'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { getMerks, createMerk, updateMerk, deleteMerk, getKategoris } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { MsMerk } from '@/lib/types';

const DEFAULT_OPTIONS = ['Sembako', 'Makanan & Snack', 'Minuman', 'Kaos & T-Shirt', 'Kemeja Pria & Wanita', 'Celana & Rok', 'HP', 'Aksesoris'];

export default function MerkPage() {
  const user = getCurrentUser();
  const [data, setData] = useState<MsMerk[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MsMerk | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nama: '', kategori: 'Sembako' });

  const load = async () => {
    setLoading(true);
    try {
      const [d, kats] = await Promise.all([
        getMerks(),
        getKategoris().catch(() => []),
      ]);
      setData(d);
      if (kats && kats.length > 0) {
        const names = Array.from(new Set([...kats.map(k => k.nama), ...d.map(m => m.kategori)]));
        setCategoryOptions(names);
        if (names.length > 0 && !form.kategori) {
          setForm(f => ({ ...f, kategori: names[0] }));
        }
      }
    } catch {
      setError('Gagal memuat data merk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ nama: '', kategori: categoryOptions[0] || 'Sembako' });
    setModalOpen(true);
  };

  const openEdit = (row: MsMerk) => {
    setEditing(row);
    setForm({ nama: row.nama, kategori: row.kategori });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setError('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) return;
    setSaving(true);
    setError('');
    try {
      if (editing) {
        const saved = await updateMerk(editing.id, { ...form, update_by: user?.username });
        setData(prev => prev.map(m => m.id === editing.id ? { ...m, ...saved } : m));
      } else {
        const saved = await createMerk({ ...form, create_by: user?.username });
        setData(prev => [...prev.filter(m => m.id !== saved.id), saved]);
      }
      closeModal();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin hapus data merk ini?')) return;
    setDeleting(id);
    try {
      await deleteMerk(id);
      setData(prev => prev.filter(d => d.id !== id));
    } catch {
      alert('Gagal menghapus data');
    } finally {
      setDeleting(null);
    }
  };

  const columns = [
    {
      key: 'nama',
      label: 'Nama Merk',
      render: (row: MsMerk) => <span style={{ fontWeight: 500 }}>{row.nama}</span>,
    },
    {
      key: 'kategori',
      label: 'Kategori',
      render: (row: MsMerk) => (
        <span className={`badge ${
          row.kategori === 'HP' ? 'badge-info' :
          row.kategori === 'HP Non Pajak' ? 'badge-purple' :
          row.kategori === 'Aksesoris' ? 'badge-success' :
          row.kategori === 'CCTV' ? 'badge-warning' :
          row.kategori === 'Sparepart' ? 'badge-teal' : 'badge-gray'
        }`}>
          {row.kategori}
        </span>
      ),
    },
    {
      key: 'create_time',
      label: 'Dibuat',
      render: (row: MsMerk) => formatDate(row.create_time),
    },
    {
      key: 'create_by',
      label: 'Dibuat Oleh',
      render: (row: MsMerk) => row.create_by ?? '-',
    },
    {
      key: 'actions',
      label: 'Aksi',
      width: '120px',
      render: (row: MsMerk) => (
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

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Merk</h1>
          <p className="page-subtitle">Kelola data merk produk berdasarkan kategori</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        onAdd={openAdd}
        addLabel="+ Tambah Merk"
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Merk' : 'Tambah Merk'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-merk">
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
              <label className="form-label">Nama Merk *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Samsung, Apple, Xiaomi..."
                value={form.nama}
                onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                autoFocus
                required
                id="input-nama-merk"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori *</label>
              <select
                className="form-control"
                value={form.kategori}
                onChange={e => setForm(f => ({ ...f, kategori: e.target.value }))}
                id="input-kategori-merk"
              >
                {categoryOptions.map(k => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
