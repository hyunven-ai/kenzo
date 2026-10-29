'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { getCurrentUser, getRoleLabel, getRoleBadgeClass } from '@/lib/auth';
import { getUsers, createUser, updateUser, deleteUser } from '@/lib/db';
import type { Role } from '@/lib/types';

interface UserItem {
  id: number;
  username: string;
  nama_lengkap: string;
  role: Role;
  is_active: boolean;
}

export default function PenggunaPage() {
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e) {
      const stored = localStorage.getItem('series_ponsel_users');
      if (stored) {
        try {
          setUsers(JSON.parse(stored));
        } catch { /* no-op */ }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    const u = getCurrentUser();
    setCurrentUser(u);
    loadUsers();
  }, []);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form, setForm] = useState({ username: '', nama_lengkap: '', role: 'kasir' as Role, password: '' });

  if (!mounted) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} /> Memuat data pengguna...
      </div>
    );
  }

  if (currentUser?.role !== 'super_admin') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <div className="empty-state-text">Akses ditolak — Hanya Super Admin yang dapat mengakses menu Pengguna</div>
      </div>
    );
  }

  const openAdd = () => { setEditing(null); setForm({ username: '', nama_lengkap: '', role: 'kasir', password: '' }); setModalOpen(true); };
  const openEdit = (u: UserItem) => { setEditing(u); setForm({ username: u.username, nama_lengkap: u.nama_lengkap, role: u.role, password: '' }); setModalOpen(true); };

  const handleSave = async () => {
    try {
      if (editing) {
        const payload: any = {
          username: form.username,
          nama_lengkap: form.nama_lengkap,
          role: form.role,
        };
        if (form.password) {
          payload.password = form.password;
        }
        await updateUser(editing.id, payload);
      } else {
        await createUser({
          username: form.username,
          nama_lengkap: form.nama_lengkap,
          role: form.role,
          password: form.password || '123456',
          is_active: true,
        });
      }
      await loadUsers();
      setModalOpen(false);
    } catch (e) {
      let updated: UserItem[];
      if (editing) {
        updated = users.map(u => u.id === editing.id ? { ...u, ...form } : u);
      } else {
        updated = [...users, { id: Date.now(), ...form, is_active: true } as UserItem];
      }
      setUsers(updated);
      localStorage.setItem('series_ponsel_users', JSON.stringify(updated));
      setModalOpen(false);
    }
  };

  const toggleActive = async (id: number) => {
    const userToUpdate = users.find(u => u.id === id);
    if (!userToUpdate) return;
    try {
      await updateUser(id, { is_active: !userToUpdate.is_active });
      await loadUsers();
    } catch {
      const updated = users.map(u => u.id === id ? { ...u, is_active: !u.is_active } : u);
      setUsers(updated);
      localStorage.setItem('series_ponsel_users', JSON.stringify(updated));
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (username.toLowerCase() === currentUser?.username.toLowerCase()) {
      alert('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif!');
      return;
    }
    if (!confirm(`Apakah Anda yakin ingin menghapus user @${username}?`)) return;
    
    try {
      await deleteUser(id);
      await loadUsers();
    } catch {
      const updated = users.filter(u => u.id !== id);
      setUsers(updated);
      localStorage.setItem('series_ponsel_users', JSON.stringify(updated));
    }
  };

  const columns = [
    { key: 'nama_lengkap', label: 'Nama', render: (row: UserItem) => <strong>{row.nama_lengkap}</strong> },
    { key: 'username', label: 'Username', render: (row: UserItem) => <code style={{ fontSize: 12 }}>@{row.username}</code> },
    { key: 'role', label: 'Role', render: (row: UserItem) => <span className={`badge ${getRoleBadgeClass(row.role)}`}>{getRoleLabel(row.role)}</span> },
    { key: 'is_active', label: 'Status', render: (row: UserItem) => <span className={`badge ${row.is_active ? 'badge-success' : 'badge-gray'}`}>{row.is_active ? 'Aktif' : 'Nonaktif'}</span> },
    {
      key: 'actions', label: 'Aksi', width: '220px',
      render: (row: UserItem) => (
        <div className="table-actions">
          <button className="btn btn-outline btn-sm" onClick={() => openEdit(row)} id={`btn-edit-user-${row.id}`}>✏️ Edit</button>
          <button
            className={`btn ${row.is_active ? 'btn-warning' : 'btn-success'} btn-sm`}
            onClick={() => toggleActive(row.id)}
            id={`btn-toggle-user-${row.id}`}
          >
            {row.is_active ? 'Nonaktif' : 'Aktif'}
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDeleteUser(row.id, row.username)}
            id={`btn-delete-user-${row.id}`}
          >
            🗑️ Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen Pengguna</h1>
          <p className="page-subtitle">Kelola akun dan hak akses pengguna sistem</p>
        </div>
      </div>

      {/* Role summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {(['super_admin', 'admin_gudang', 'kasir'] as Role[]).map(role => {
          const count = users.filter(u => u.role === role).length;
          return (
            <div key={role} className="card card-body">
              <div style={{ fontSize: 12, color: '#888' }}>{getRoleLabel(role)}</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{count} user</div>
              <div><span className={`badge ${getRoleBadgeClass(role)}`}>{role}</span></div>
            </div>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        onAdd={openAdd}
        addLabel="+ Tambah User"
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Pengguna' : 'Tambah Pengguna'}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave} id="btn-save-user">Simpan</button>
        </>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Nama Lengkap *</label>
            <input type="text" className="form-control" value={form.nama_lengkap} onChange={e => setForm(f => ({ ...f, nama_lengkap: e.target.value }))} id="user-nama" />
          </div>
          <div className="form-group">
            <label className="form-label">Username *</label>
            <input type="text" className="form-control" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} id="user-username" />
          </div>
          <div className="form-group">
            <label className="form-label">Password {editing ? '(kosongkan jika tidak diubah)' : '*'}</label>
            <input type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder={editing ? '••••••••' : 'Password baru'} id="user-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Role *</label>
            <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} id="user-role">
              <option value="super_admin">Super Admin</option>
              <option value="admin_gudang">Admin Gudang</option>
              <option value="kasir">Kasir</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
