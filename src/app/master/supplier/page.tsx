'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatDate } from '@/lib/utils';
import type { MsSupplier } from '@/lib/types';

export default function SupplierPage() {
  const user = getCurrentUser();
  const [data, setData] = useState<MsSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MsSupplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ nama: '' });

  const load = async () => {
    setLoading(true);
    try { setData(await getSuppliers()); }
    catch { setError('Gagal memuat data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => { setEditing(null); setForm({ nama: '' }); setModalOpen(true); };
  const openEdit = (row: MsSupplier) => { setEditing(row); setForm({ nama: row.nama }); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); setError(''); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) return;
    setSaving(true); setError('');
    try {
      if (editing) {
        const saved = await updateSupplier(editing.id, { ...form, update_by: user?.username });
        setData(d => d.map(r => r.id === editing.id ? { ...r, ...saved } : r));
      } else {
        const saved = await createSupplier({ ...form, create_by: user?.username });
        setData(d => [...d.filter(r => r.id !== saved.id), saved]);
      }
      closeModal();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus supplier ini?')) return;
    try { await deleteSupplier(id); setData(d => d.filter(r => r.id !== id)); }
    catch { alert('Gagal menghapus'); }
  };

  const columns = [
    {
      key: 'nama', label: 'Nama Supplier',
      render: (row: MsSupplier) => <span style={{ fontWeight: 500 }}>{row.nama}</span>,
    },
    { key: 'create_time', label: 'Dibuat', render: (row: MsSupplier) => formatDate(row.create_time) },
    { key: 'create_by', label: 'Dibuat Oleh', render: (row: MsSupplier) => row.create_by ?? '-' },
    {
      key: 'actions', label: 'Aksi', width: '120px',
      render: (row: MsSupplier) => (
        <div className="table-actions">
          <button className="btn btn-outline btn-sm" onClick={() => openEdit(row)} id={`btn-edit-sup-${row.id}`}>✏️</button>
          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(row.id)} id={`btn-del-sup-${row.id}`}>🗑️</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Master Supplier</h1>
          <p className="page-subtitle">Kelola data pemasok/vendor barang toko</p>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data}
        loading={loading} onAdd={openAdd} addLabel="+ Tambah Supplier"
      />
      <Modal isOpen={modalOpen} onClose={closeModal} title={editing ? 'Edit Supplier' : 'Tambah Supplier'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal}>Batal</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-sup">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error mb-16">{error}</div>}
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Nama Supplier *</label>
            <input
              type="text" className="form-control"
              placeholder="Nama vendor / pemasok barang..."
              value={form.nama} onChange={e => setForm({ nama: e.target.value })}
              autoFocus required id="input-nama-sup"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
