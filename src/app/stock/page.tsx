'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import NumericInput from '@/components/ui/NumericInput';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import {
  getBarangs,
  createBarang,
  updateBarang,
  deleteBarang,
  getKategoris,
  getMerks,
  createMerk,
  getSuppliers,
  createSupplier,
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatRupiah, formatDate } from '@/lib/utils';
import type { MsBarang, MsKategori, MsMerk, MsSupplier } from '@/lib/types';

const SATUAN_LIST = [
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
  'Karung',
  'Pouch',
];

const emptyForm = {
  barcode: '',
  nama: '',
  kategori: 'Sembako',
  merk: '',
  supplier: '',
  satuan: 'Pcs',
  qty: 10,
  harga_modal: 0,
  harga_jual: 0,
  warna: '',
  ukuran: '',
  keterangan: '',
};

function StockContent() {
  const user = getCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const kategoriQuery = searchParams.get('kategori') || 'semua';

  const [data, setData] = useState<MsBarang[]>([]);
  const [categories, setCategories] = useState<MsKategori[]>([]);
  const [merks, setMerks] = useState<MsMerk[]>([]);
  const [suppliers, setSuppliers] = useState<MsSupplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MsBarang | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [scannerOpen, setScannerOpen] = useState(false);

  // Filters
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterMerk, setFilterMerk] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [barangs, kats, mks, sups] = await Promise.all([
        getBarangs(),
        getKategoris(),
        getMerks().catch(() => []),
        getSuppliers().catch(() => []),
      ]);
      setData(barangs);
      setCategories(kats);
      setMerks(mks);
      setSuppliers(sups);
    } catch {
      setError('Gagal memuat data stock');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleKategoriChange = () => {
      getKategoris().then(setCategories).catch(() => {});
    };
    const handleMerkChange = () => {
      getMerks().then(setMerks).catch(() => {});
    };
    const handleSupplierChange = () => {
      getSuppliers().then(setSuppliers).catch(() => {});
    };

    window.addEventListener('kategori_updated', handleKategoriChange);
    window.addEventListener('merk_updated', handleMerkChange);
    window.addEventListener('supplier_updated', handleSupplierChange);
    return () => {
      window.removeEventListener('kategori_updated', handleKategoriChange);
      window.removeEventListener('merk_updated', handleMerkChange);
      window.removeEventListener('supplier_updated', handleSupplierChange);
    };
  }, []);

  const openAdd = () => {
    setEditing(null);
    const initialKategori =
      kategoriQuery !== 'semua'
        ? kategoriQuery
        : categories[0]?.nama || 'Sembako';
    const foundKat = categories.find(k => k.nama === initialKategori);

    setForm({
      ...emptyForm,
      barcode: `BRG-${Date.now().toString().slice(-6)}`,
      kategori: initialKategori,
      satuan: foundKat?.satuan_default || 'Pcs',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (row: MsBarang) => {
    setEditing(row);
    setForm({
      barcode: row.barcode,
      nama: row.nama,
      kategori: row.kategori,
      merk: row.merk || '',
      supplier: row.supplier || '',
      satuan: row.satuan || 'Pcs',
      qty: row.qty,
      harga_modal: row.harga_modal,
      harga_jual: row.harga_jual,
      warna: row.warna || '',
      ukuran: row.ukuran || '',
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

  const handleKategoriFormChange = (newKatName: string) => {
    const kat = categories.find(k => k.nama === newKatName);
    setForm(f => ({
      ...f,
      kategori: newKatName,
      satuan: kat?.satuan_default || f.satuan || 'Pcs',
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      setError('Nama barang tidak boleh kosong');
      return;
    }
    if (!form.barcode.trim()) {
      setError('Barcode tidak boleh kosong');
      return;
    }
    if (form.harga_jual < 0 || form.harga_modal < 0) {
      setError('Harga tidak boleh bernilai negatif');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        barcode: form.barcode.trim(),
        nama: form.nama.trim(),
        kategori: form.kategori,
        merk: form.merk.trim() || undefined,
        supplier: form.supplier.trim() || undefined,
        satuan: form.satuan || 'Pcs',
        qty: Number(form.qty) || 0,
        harga_modal: Number(form.harga_modal) || 0,
        harga_jual: Number(form.harga_jual) || 0,
        warna: form.warna.trim() || undefined,
        ukuran: form.ukuran.trim() || undefined,
        keterangan: form.keterangan.trim() || undefined,
      };

      if (editing) {
        await updateBarang(editing.id, {
          ...payload,
          update_by: user?.username,
        });
      } else {
        await createBarang({
          ...payload,
          create_by: user?.username,
        });
      }

      await loadData();
      closeModal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan barang');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus barang ini dari stok?')) return;
    setDeleting(id);
    try {
      await deleteBarang(id);
      setData(prev => prev.filter(d => d.id !== id));
    } catch {
      alert('Gagal menghapus barang');
    } finally {
      setDeleting(null);
    }
  };

  const generateBarcode = () => {
    const randomCode = `${form.kategori.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
    setForm(f => ({ ...f, barcode: randomCode }));
  };

  // Filter Data by Active Category & Selectors
  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchKategori =
        kategoriQuery === 'semua' || item.kategori === kategoriQuery;
      const matchSupplier =
        !filterSupplier || item.supplier === filterSupplier;
      const matchMerk = !filterMerk || item.merk === filterMerk;
      return matchKategori && matchSupplier && matchMerk;
    });
  }, [data, kategoriQuery, filterSupplier, filterMerk]);

  // KPI Calculations
  const stats = useMemo(() => {
    let totalItems = filteredData.length;
    let totalQty = 0;
    let totalModal = 0;
    let totalJual = 0;

    filteredData.forEach(item => {
      totalQty += item.qty || 0;
      totalModal += (item.harga_modal || 0) * (item.qty || 0);
      totalJual += (item.harga_jual || 0) * (item.qty || 0);
    });

    return { totalItems, totalQty, totalModal, totalJual };
  }, [filteredData]);

  // Selected Category Info
  const activeCategoryObj = useMemo(() => {
    return categories.find(k => k.nama === kategoriQuery);
  }, [categories, kategoriQuery]);

  const columns = [
    {
      key: 'barcode',
      label: 'Barcode / Kode',
      width: '150px',
      render: (row: MsBarang) => (
        <span
          className="badge badge-gray font-mono"
          style={{ fontSize: 12, letterSpacing: '0.04em' }}
          title={row.barcode}
        >
          {row.barcode}
        </span>
      ),
    },
    {
      key: 'nama',
      label: 'Nama Produk / Barang',
      render: (row: MsBarang) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{row.nama}</div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted, #71717a)',
              display: 'flex',
              gap: 8,
              marginTop: 2,
            }}
          >
            {row.merk && <span>Merk: {row.merk}</span>}
            {row.ukuran && <span>Ukuran: {row.ukuran}</span>}
            {row.warna && <span>Warna: {row.warna}</span>}
            {row.supplier && <span>Supplier: {row.supplier}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'kategori',
      label: 'Kategori',
      width: '150px',
      render: (row: MsBarang) => (
        <span className="badge badge-info">{row.kategori}</span>
      ),
    },
    {
      key: 'qty',
      label: 'Stok',
      width: '120px',
      render: (row: MsBarang) => {
        const isLow = row.qty <= 5;
        return (
          <div>
            <span
              className={`badge ${isLow ? 'badge-error' : 'badge-success'}`}
              style={{ fontWeight: 700 }}
            >
              {row.qty} {row.satuan || 'Pcs'}
            </span>
            {isLow && (
              <div
                style={{ fontSize: 10, color: '#e53935', marginTop: 2, fontWeight: 600 }}
              >
                Menipis!
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'harga_modal',
      label: 'Harga Modal',
      width: '140px',
      render: (row: MsBarang) => (
        <span style={{ fontSize: 13, color: 'var(--text-muted, #71717a)' }}>
          {formatRupiah(row.harga_modal)}
        </span>
      ),
    },
    {
      key: 'harga_jual',
      label: 'Harga Jual',
      width: '150px',
      render: (row: MsBarang) => {
        const margin = row.harga_jual - row.harga_modal;
        const percent = row.harga_modal > 0 ? Math.round((margin / row.harga_modal) * 100) : 0;
        return (
          <div>
            <div style={{ fontWeight: 700, color: 'var(--primary, #059669)' }}>
              {formatRupiah(row.harga_jual)}
            </div>
            <div style={{ fontSize: 11, color: '#10b981' }}>
              +{formatRupiah(margin)} ({percent}%)
            </div>
          </div>
        );
      },
    },
    {
      key: 'actions',
      label: 'Aksi',
      width: '140px',
      render: (row: MsBarang) => (
        <div className="table-actions">
          <Link
            href={`/barcode`}
            className="btn btn-outline btn-sm"
            title="Cetak Label Barcode Thermal"
            style={{ textDecoration: 'none', padding: '3px 7px' }}
          >
            🏷️
          </Link>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => openEdit(row)}
            title="Edit Barang"
            id={`btn-edit-barang-${row.id}`}
          >
            ✏️
          </button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => handleDelete(row.id)}
            title="Hapus Barang"
            disabled={deleting === row.id}
            id={`btn-del-barang-${row.id}`}
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
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 16 }}>
        <div>
          <h1 className="page-title">
            {kategoriQuery === 'semua'
              ? '📦 Semua Stock Produk'
              : `📦 Stock: ${kategoriQuery}`}
          </h1>
          <p className="page-subtitle">
            {activeCategoryObj?.keterangan
              ? activeCategoryObj.keterangan
              : 'Kelola data stok barang, barcode, harga modal & harga jual'}
          </p>
        </div>
        <Link
          href="/barcode"
          className="btn btn-secondary"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          title="Buka menu Cetak Label Barcode Thermal"
          id="btn-goto-barcode-labels"
        >
          <span>🏷️</span>
          <span>Cetak Label Barcode</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div className="stat-card" style={{ padding: 16, borderRadius: 8, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>Total Varian Produk</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
            {stats.totalItems} <span style={{ fontSize: 13, fontWeight: 400 }}>Item</span>
          </div>
        </div>

        <div className="stat-card" style={{ padding: 16, borderRadius: 8, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>Total Stok Fisik</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: '#10b981' }}>
            {stats.totalQty} <span style={{ fontSize: 13, fontWeight: 400 }}>Unit</span>
          </div>
        </div>

        <div className="stat-card" style={{ padding: 16, borderRadius: 8, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>Total Nilai Modal (Aset)</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#f59e0b' }}>
            {formatRupiah(stats.totalModal)}
          </div>
        </div>

        <div className="stat-card" style={{ padding: 16, borderRadius: 8, background: 'var(--bg-card)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #71717a)' }}>Potensi Nilai Jual (Omset)</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: '#3b82f6' }}>
            {formatRupiah(stats.totalJual)}
          </div>
        </div>
      </div>

      {/* Horizontal Category Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 6,
          whiteSpace: 'nowrap',
        }}
      >
        <button
          type="button"
          className={`btn btn-sm ${kategoriQuery === 'semua' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => router.push('/stock')}
        >
          Semua ({data.length})
        </button>
        {categories.map(k => {
          const count = data.filter(d => d.kategori === k.nama).length;
          const isActive = kategoriQuery === k.nama;
          const icon = k.jenis_toko === 'kelontong' ? '🏪 ' : k.jenis_toko === 'baju' ? '👕 ' : '';
          return (
            <button
              key={k.id}
              type="button"
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => router.push(`/stock?kategori=${encodeURIComponent(k.nama)}`)}
            >
              {icon}{k.nama} ({count})
            </button>
          );
        })}
      </div>

      {/* Additional Filter Row */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
          background: 'var(--bg-card)',
          padding: 12,
          borderRadius: 8,
          border: '1px solid var(--border-light, #27272a)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted, #71717a)', fontWeight: 500 }}>
            Filter Merk:
          </label>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 140, padding: '4px 8px', fontSize: 13 }}
            value={filterMerk}
            onChange={e => setFilterMerk(e.target.value)}
          >
            <option value="">Semua Merk</option>
            {Array.from(new Set(data.map(d => d.merk).filter(Boolean))).map(m => (
              <option key={m} value={m!}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted, #71717a)', fontWeight: 500 }}>
            Filter Supplier:
          </label>
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: 160, padding: '4px 8px', fontSize: 13 }}
            value={filterSupplier}
            onChange={e => setFilterSupplier(e.target.value)}
          >
            <option value="">Semua Supplier</option>
            {Array.from(new Set(data.map(d => d.supplier).filter(Boolean))).map(s => (
              <option key={s} value={s!}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {(filterMerk || filterSupplier) && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              setFilterMerk('');
              setFilterSupplier('');
            }}
          >
            ✕ Reset Filter
          </button>
        )}
      </div>

      {/* Stock DataTable */}
      <DataTable
        columns={columns}
        data={filteredData}
        loading={loading}
        onAdd={openAdd}
        addLabel={
          kategoriQuery !== 'semua'
            ? `+ Tambah ${kategoriQuery}`
            : '+ Tambah Barang Stock'
        }
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        size="lg"
        title={
          editing
            ? `Edit Barang: ${editing.nama}`
            : kategoriQuery !== 'semua'
            ? `Tambah Barang ke ${kategoriQuery}`
            : 'Tambah Barang Stock Baru'
        }
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeModal} type="button">
              Batal
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              id="btn-save-barang"
              type="button"
            >
              {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : null}
              {saving ? 'Menyimpan...' : 'Simpan Barang'}
            </button>
          </>
        }
      >
        {error && <div className="alert alert-error mb-16">{error}</div>}
        <form onSubmit={handleSave}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {/* Barcode Section */}
            <div className="form-group">
              <label className="form-label">Barcode / Kode Produk *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="form-control font-mono"
                  placeholder="Scan barcode..."
                  value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  required
                  id="input-barcode"
                />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                  onClick={() => setScannerOpen(true)}
                  title="Scan Barcode via Kamera"
                >
                  📷 Scan
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                  onClick={generateBarcode}
                  title="Buat barcode unik otomatis"
                >
                  ⚡ Acak
                </button>
              </div>
            </div>

            {/* Nama Barang */}
            <div className="form-group">
              <label className="form-label">Nama Barang / Produk *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Beras Rojo Lele 5kg / Kaos Combed 30s..."
                value={form.nama}
                onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
                required
                id="input-nama-barang"
              />
            </div>

            {/* Kategori */}
            <div className="form-group">
              <label className="form-label">Kategori Stock *</label>
              <select
                className="form-control"
                value={form.kategori}
                onChange={e => handleKategoriFormChange(e.target.value)}
                required
                id="input-kategori-barang"
              >
                {categories.map(k => (
                  <option key={k.id} value={k.nama}>
                    {k.nama} ({k.jenis_toko === 'kelontong' ? 'Kelontong' : k.jenis_toko === 'baju' ? 'Baju' : 'Umum'})
                  </option>
                ))}
              </select>
            </div>

            {/* Satuan */}
            <div className="form-group">
              <label className="form-label">Satuan Standar</label>
              <select
                className="form-control"
                value={form.satuan}
                onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}
                id="input-satuan-barang"
              >
                {SATUAN_LIST.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Merk */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Merk / Brand</label>
                <Link
                  href="/master/merk"
                  target="_blank"
                  style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}
                  title="Buka menu Master Merk"
                >
                  ⚙️ Master Merk
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-control"
                  value={form.merk}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      const newM = prompt('Ketik nama Merk baru untuk ditambahkan:')?.trim();
                      if (newM) {
                        setForm(f => ({ ...f, merk: newM }));
                        if (!merks.some(m => m.nama.toLowerCase() === newM.toLowerCase())) {
                          createMerk({ nama: newM, kategori: form.kategori || 'Umum' })
                            .then(added => setMerks(prev => [...prev, added]))
                            .catch(() => {});
                        }
                      }
                    } else {
                      setForm(f => ({ ...f, merk: val }));
                    }
                  }}
                  id="input-merk-barang"
                >
                  <option value="">-- Pilih Merk / Brand (Opsional) --</option>
                  {merks.map(m => (
                    <option key={m.id} value={m.nama}>
                      {m.nama} {m.kategori ? `(${m.kategori})` : ''}
                    </option>
                  ))}
                  {form.merk && !merks.some(m => m.nama.toLowerCase() === form.merk.toLowerCase()) && (
                    <option value={form.merk}>{form.merk} (Kustom)</option>
                  )}
                  <option value="__custom__">➕ Tambah Merk Baru...</option>
                </select>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                  onClick={() => {
                    const newM = prompt('Ketik nama Merk baru:')?.trim();
                    if (newM) {
                      setForm(f => ({ ...f, merk: newM }));
                      if (!merks.some(m => m.nama.toLowerCase() === newM.toLowerCase())) {
                        createMerk({ nama: newM, kategori: form.kategori || 'Umum' })
                          .then(added => setMerks(prev => [...prev, added]))
                          .catch(() => {});
                      }
                    }
                  }}
                  title="Tambah Merk baru langsung"
                >
                  + Merk
                </button>
              </div>
            </div>

            {/* Supplier */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Supplier / Distributor</label>
                <Link
                  href="/master/supplier"
                  target="_blank"
                  style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', fontWeight: 600 }}
                  title="Buka menu Master Supplier"
                >
                  ⚙️ Master Supplier
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-control"
                  value={form.supplier}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      const newS = prompt('Ketik nama Supplier baru untuk ditambahkan:')?.trim();
                      if (newS) {
                        setForm(f => ({ ...f, supplier: newS }));
                        if (!suppliers.some(s => s.nama.toLowerCase() === newS.toLowerCase())) {
                          createSupplier({ nama: newS })
                            .then(added => setSuppliers(prev => [...prev, added]))
                            .catch(() => {});
                        }
                      }
                    } else {
                      setForm(f => ({ ...f, supplier: val }));
                    }
                  }}
                  id="input-supplier-barang"
                >
                  <option value="">-- Pilih Supplier / Distributor (Opsional) --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.nama}>
                      {s.nama}
                    </option>
                  ))}
                  {form.supplier && !suppliers.some(s => s.nama.toLowerCase() === form.supplier.toLowerCase()) && (
                    <option value={form.supplier}>{form.supplier} (Kustom)</option>
                  )}
                  <option value="__custom__">➕ Tambah Supplier Baru...</option>
                </select>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ whiteSpace: 'nowrap', padding: '0 10px' }}
                  onClick={() => {
                    const newS = prompt('Ketik nama Supplier baru:')?.trim();
                    if (newS) {
                      setForm(f => ({ ...f, supplier: newS }));
                      if (!suppliers.some(s => s.nama.toLowerCase() === newS.toLowerCase())) {
                        createSupplier({ nama: newS })
                          .then(added => setSuppliers(prev => [...prev, added]))
                          .catch(() => {});
                      }
                    }
                  }}
                  title="Tambah Supplier baru langsung"
                >
                  + Supplier
                </button>
              </div>
            </div>

            {/* Qty */}
            <div className="form-group">
              <label className="form-label">Jumlah Stok Fisik *</label>
              <input
                type="number"
                min="0"
                className="form-control"
                value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: Math.max(0, parseInt(e.target.value) || 0) }))}
                required
                id="input-qty-barang"
              />
            </div>

            {/* Harga Modal & Harga Jual */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="form-group">
                <label className="form-label">Harga Modal *</label>
                <NumericInput
                  value={form.harga_modal}
                  onChange={val => setForm(f => ({ ...f, harga_modal: val }))}
                  placeholder="0"
                  required
                  id="input-harga-modal"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Harga Jual *</label>
                <NumericInput
                  value={form.harga_jual}
                  onChange={val => setForm(f => ({ ...f, harga_jual: val }))}
                  placeholder="0"
                  required
                  id="input-harga-jual"
                />
              </div>
            </div>

            {/* Ukuran & Warna */}
            <div className="form-group">
              <label className="form-label">Ukuran / Size (Opsional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: S, M, L, XL, 32, 2L, 5kg..."
                value={form.ukuran}
                onChange={e => setForm(f => ({ ...f, ukuran: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Warna / Varian (Opsional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Hitam, Navy, Putih, Pedas Manis..."
                value={form.warna}
                onChange={e => setForm(f => ({ ...f, warna: e.target.value }))}
              />
            </div>

            {/* Keterangan (Spans full width) */}
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Keterangan / Catatan Tambahan</label>
              <textarea
                className="form-control"
                rows={2}
                placeholder="Catatan tambahan mengenai produk..."
                value={form.keterangan}
                onChange={e => setForm(f => ({ ...f, keterangan: e.target.value }))}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={code => {
          setForm(f => ({ ...f, barcode: code }));
          setScannerOpen(false);
        }}
      />
    </div>
  );
}

export default function StockPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Memuat Manajemen Stock...</div>
        </div>
      }
    >
      <StockContent />
    </Suspense>
  );
}
