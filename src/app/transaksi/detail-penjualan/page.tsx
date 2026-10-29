'use client';

import { useState, useEffect } from 'react';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import { getPenjualan, deletePenjualan, updatePenjualanHeader, getMerks } from '@/lib/db';
import { formatRupiah, formatDateTime, today, daysAgo } from '@/lib/utils';
import type { TrsPenjualanHdr, TrsPenjualanDtl, MetodePembayaran, MsMerk } from '@/lib/types';
import PrintReceipt from '@/components/ui/PrintReceipt';
import { getCurrentUser } from '@/lib/auth';

export default function DetailPenjualanPage() {
  const user = getCurrentUser();
  const isSuperAdmin = user?.role === 'super_admin';

  const [data, setData] = useState<(TrsPenjualanHdr & { detail_barang_search?: string })[]>([]);
  const [merks, setMerks] = useState<MsMerk[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [tempFrom, setTempFrom] = useState(today());
  const [tempTo, setTempTo] = useState(today());
  const [tempKategori, setTempKategori] = useState('');
  const [tempMerk, setTempMerk] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('');
  const [selectedMerk, setSelectedMerk] = useState('');
  const [dtlModal, setDtlModal] = useState(false);
  const [selected, setSelected] = useState<TrsPenjualanHdr | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState('');
  const [editMetode, setEditMetode] = useState<MetodePembayaran>('Tunai');
  const [editTanggal, setEditTanggal] = useState('');
  const [editKasir, setEditKasir] = useState('');
  const [saving, setSaving] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    nomor_invoice: true,
    customer: true,
    supplier_search: true,
    tanggal_penjualan: true,
    imei_search: true,
    brand_search: true,
    detail_barang_search: true,
    metode_pembayaran: true,
    total: true,
    total_modal: true,
    total_jual: true,
    total_profit: true,
    create_by: true,
  });
  const [showColDropdown, setShowColDropdown] = useState(false);

  const startEdit = (row: TrsPenjualanHdr) => {
    setEditCustomer(row.customer);
    setEditMetode(row.metode_pembayaran ?? 'Tunai');
    const dateObj = new Date(row.tanggal_penjualan);
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
    setEditTanggal(localISOTime);
    setEditKasir(row.create_by ?? '');
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await updatePenjualanHeader(selected.id, {
        customer: editCustomer,
        metode_pembayaran: editMetode,
        tanggal_penjualan: new Date(editTanggal).toISOString(),
        create_by: editKasir,
      });
      setSelected({ ...selected, ...updated });
      setIsEditing(false);
      load(from, to);
    } catch (e: any) {
      alert(e?.message || 'Gagal menyimpan perubahan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini? Stok barang yang terjual akan dikembalikan ke gudang.')) return;
    try {
      await deletePenjualan(id);
      setDtlModal(false);
      setSelected(null);
      load(from, to);
    } catch (e: any) {
      alert(e?.message || 'Gagal menghapus transaksi');
    }
  };

  const load = async (f: string, t: string) => {
    setLoading(true);
    try {
      const [result, mList] = await Promise.all([
        getPenjualan(f, t),
        getMerks()
      ]);
      setMerks(mList);
      const mapped = result.map(row => {
        const dtls: TrsPenjualanDtl[] = (row as any).details ?? (row as any).trs_penjualan_dtl ?? [];
        const itemsString = dtls.map(d => d.nama_barang).join(', ');
        const supplierString = dtls.map(d => d.supplier || '-').filter((v, i, a) => v !== '-' && a.indexOf(v) === i).join(', ') || '-';
        const imeiString = dtls.map(d => d.code).filter(c => c).join(', ') || '-';
        const brandString = dtls.map(d => {
          const match = mList.find(m => d.nama_barang.toLowerCase().includes(m.nama.toLowerCase()));
          return match ? match.nama : '';
        }).filter((v, i, a) => v && a.indexOf(v) === i).join(', ') || '-';

        const totalModal = dtls.reduce((s, item) => s + (item.harga_modal * item.qty), 0);
        const totalProfit = dtls.reduce((s, item) => s + (item.harga_jual - item.harga_modal) * item.qty, 0);

        return {
          ...row,
          detail_barang_search: itemsString,
          supplier_search: supplierString,
          imei_search: imeiString,
          brand_search: brandString,
          total_modal: totalModal,
          total_profit: totalProfit,
        };
      });
      setData(mapped);
    }
    catch (err) {
      console.error("Error loading sales details:", err);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(from, to); }, []);

  const handleFilter = () => {
    setFrom(tempFrom);
    setTo(tempTo);
    setSelectedKategori(tempKategori);
    setSelectedMerk(tempMerk);
    load(tempFrom, tempTo);
  };
  const handleReset = () => {
    const f = today(), t = today();
    setTempFrom(f); setTempTo(t); setFrom(f); setTo(t);
    setTempKategori(''); setTempMerk('');
    setSelectedKategori(''); setSelectedMerk('');
    load(f, t);
  };

  const handlePrint = (row: TrsPenjualanHdr) => {
    setSelected(row);
    setTimeout(() => window.print(), 200);
  };

  // Filter client-side
  const filteredData = data.filter(row => {
    const dtls = (row as unknown as { trs_penjualan_dtl?: TrsPenjualanDtl[] }).trs_penjualan_dtl ?? [];
    
    // Precise local timezone date comparison
    if (row.tanggal_penjualan) {
      const localDate = new Date(row.tanggal_penjualan);
      const y = localDate.getFullYear();
      const m = String(localDate.getMonth() + 1).padStart(2, '0');
      const d = String(localDate.getDate()).padStart(2, '0');
      const rowLocalDateStr = `${y}-${m}-${d}`;

      if (from && rowLocalDateStr < from) return false;
      if (to && rowLocalDateStr > to) return false;
    }

    // Kategori Filter
    if (selectedKategori) {
      const hasKategori = dtls.some(d => d.kategori === selectedKategori);
      if (!hasKategori) return false;
    }
    
    // Brand/Merk Filter
    if (selectedMerk) {
      const hasMerk = dtls.some(d => d.nama_barang.toLowerCase().includes(selectedMerk.toLowerCase()));
      if (!hasMerk) return false;
    }
    
    return true;
  });

  const totalPenjualan = filteredData.reduce((sum, d) => sum + (d.total_harga ?? 0), 0);
  const totalProfit = filteredData.reduce((sum, d) => {
    const dtls = (d as unknown as { trs_penjualan_dtl?: TrsPenjualanDtl[] }).trs_penjualan_dtl ?? [];
    return sum + dtls.reduce((s, item) => s + (item.harga_jual - item.harga_modal) * item.qty, 0);
  }, 0);

  const columns = [
    { key: 'nomor_invoice', label: 'No. Invoice', render: (row: TrsPenjualanHdr) => <code style={{ fontSize: 11 }}>{row.nomor_invoice}</code> },
    { key: 'customer', label: 'Pelanggan', render: (row: TrsPenjualanHdr) => <strong>{row.customer}</strong> },
    {
      key: 'supplier_search',
      label: 'Supplier',
      render: (row: TrsPenjualanHdr & { supplier_search?: string }) => (
        <span style={{ fontSize: 12, color: '#555', display: 'block', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.supplier_search}>
          {row.supplier_search || '-'}
        </span>
      ),
    },
    { key: 'tanggal_penjualan', label: 'Tanggal', render: (row: TrsPenjualanHdr) => formatDateTime(row.tanggal_penjualan) },
    {
      key: 'imei_search',
      label: 'IMEI',
      render: (row: TrsPenjualanHdr & { imei_search?: string }) => (
        <span style={{ fontSize: 12, color: '#555', display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.imei_search}>
          {row.imei_search || '-'}
        </span>
      ),
    },
    {
      key: 'brand_search',
      label: 'Merek',
      render: (row: TrsPenjualanHdr & { brand_search?: string }) => (
        <span style={{ fontSize: 12, color: '#555', display: 'block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.brand_search}>
          {row.brand_search || '-'}
        </span>
      ),
    },
    {
      key: 'detail_barang_search',
      label: 'Barang',
      render: (row: TrsPenjualanHdr & { detail_barang_search?: string }) => (
        <span style={{ fontSize: 12, color: '#555', display: 'block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.detail_barang_search}>
          {row.detail_barang_search || '-'}
        </span>
      ),
    },
    {
      key: 'metode_pembayaran', label: 'Metode',
      render: (row: TrsPenjualanHdr) => (
        <span className="badge badge-info" style={{ fontSize: 11 }}>
          {row.metode_pembayaran ?? 'Tunai'}
        </span>
      ),
    },
    ...(user?.role === 'super_admin' ? [
      {
        key: 'total_modal',
        label: 'Harga Modal',
        render: (row: any) => <span>{formatRupiah(row.total_modal ?? 0)}</span>,
      },
      {
        key: 'total_jual',
        label: 'Harga Jual',
        render: (row: any) => <span>{formatRupiah(row.total_harga ?? 0)}</span>,
      },
      {
        key: 'total_profit',
        label: 'Keuntungan',
        render: (row: any) => <span style={{ color: '#2e7d32', fontWeight: 600 }}>{formatRupiah(row.total_profit ?? 0)}</span>,
      },
    ] : []),
    {
      key: 'total', label: 'Total',
      render: (row: TrsPenjualanHdr) => <span style={{ fontWeight: 700, color: '#1565c0' }}>{formatRupiah(row.total_harga ?? 0)}</span>,
    },
    { key: 'create_by', label: 'Kasir', render: (row: TrsPenjualanHdr) => row.create_by ?? '-' },
    {
      key: 'actions', label: 'Aksi', width: '140px',
      render: (row: TrsPenjualanHdr) => (
        <div className="table-actions">
          <button className="btn btn-outline btn-sm" onClick={() => { setSelected(row); setDtlModal(true); setIsEditing(false); }} id={`btn-dtl-${row.id}`}>Detail</button>
          <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(row)} id={`btn-print-${row.id}`}>🖨️</button>
        </div>
      ),
    },
  ];

  const renderTableFooter = (sortedData: any[]) => {
    const totalModalSum = sortedData.reduce((s, row) => s + (row.total_modal ?? 0), 0);
    const totalJualSum = sortedData.reduce((s, row) => s + (row.total_harga ?? 0), 0);
    const totalProfitSum = sortedData.reduce((s, row) => s + (row.total_profit ?? 0), 0);
    const totalSum = sortedData.reduce((s, row) => s + (row.total_harga ?? 0), 0);

    const activeCols = columns.filter(col => col.key === 'actions' || (visibleColumns[col.key] ?? true));

    return (
      <tr style={{ fontWeight: 700, background: '#f8f9fa', borderTop: '2px solid #ccc' }}>
        <td style={{ color: '#222' }}>Total</td>
        {activeCols.map(col => {
          if (col.key === 'total_modal') {
            return <td key={col.key} style={{ color: '#222' }}>{formatRupiah(totalModalSum)}</td>;
          }
          if (col.key === 'total_jual') {
            return <td key={col.key} style={{ color: '#222' }}>{formatRupiah(totalJualSum)}</td>;
          }
          if (col.key === 'total_profit') {
            return <td key={col.key} style={{ color: '#2e7d32' }}>{formatRupiah(totalProfitSum)}</td>;
          }
          if (col.key === 'total') {
            return <td key={col.key} style={{ color: '#1565c0' }}>{formatRupiah(totalSum)}</td>;
          }
          return <td key={col.key}></td>;
        })}
      </tr>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Detail Penjualan</h1>
      </div>

      {/* Filter */}
      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <div className="form-group" style={{ minWidth: 140, flex: 1 }}>
          <label className="form-label">Dari</label>
          <input type="date" className="form-control" value={tempFrom} onChange={e => setTempFrom(e.target.value)} id="dtl-from" />
        </div>
        <div className="form-group" style={{ minWidth: 140, flex: 1 }}>
          <label className="form-label">Sampai</label>
          <input type="date" className="form-control" value={tempTo} onChange={e => setTempTo(e.target.value)} id="dtl-to" />
        </div>
        <div className="form-group" style={{ minWidth: 150, flex: 1 }}>
          <label className="form-label">Kategori Barang</label>
          <select className="form-control" value={tempKategori} onChange={e => setTempKategori(e.target.value)} id="dtl-kategori">
            <option value="">Semua Kategori</option>
            <option value="HP">HP</option>
            <option value="HP Non Pajak">HP Non Pajak</option>
            <option value="Aksesoris">Aksesoris</option>
            <option value="CCTV">CCTV</option>
            <option value="Kuota">Kuota</option>
          </select>
        </div>
        <div className="form-group" style={{ minWidth: 150, flex: 1 }}>
          <label className="form-label">Merk</label>
          <select className="form-control" value={tempMerk} onChange={e => setTempMerk(e.target.value)} id="dtl-merk">
            <option value="">Semua Merk</option>
            {Array.from(new Set(merks.map(m => m.nama))).map(merkName => (
              <option key={merkName} value={merkName}>{merkName}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, height: 38 }}>
          <button className="btn btn-secondary" onClick={handleReset} id="btn-reset-dtl">Reset</button>
          <button className="btn btn-primary" onClick={handleFilter} id="btn-filter-dtl">Filter</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="metric-cards-grid" style={{ gridTemplateColumns: user?.role === 'kasir' ? '1fr 1fr' : '1fr 1fr 1fr', marginBottom: 20 }}>
        <div className="metric-card metric-card-blue">
          <div className="metric-card-label">Jumlah Transaksi</div>
          <div className="metric-card-value" style={{ fontSize: 28 }}>{filteredData.length}</div>
        </div>
        <div className="metric-card metric-card-green">
          <div className="metric-card-label">Total Penjualan</div>
          <div className="metric-card-value">{formatRupiah(totalPenjualan)}</div>
        </div>
        {user?.role !== 'kasir' && (
          <div className="metric-card metric-card-teal">
            <div className="metric-card-label">Total Profit</div>
            <div className="metric-card-value">{formatRupiah(totalProfit)}</div>
          </div>
        )}
      </div>

      <DataTable
        columns={columns.filter(col => col.key === 'actions' || (visibleColumns[col.key] ?? true))}
        data={filteredData}
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
                    nomor_invoice: 'No. Invoice',
                    customer: 'Pelanggan',
                    supplier_search: 'Supplier',
                    tanggal_penjualan: 'Tanggal',
                    imei_search: 'IMEI',
                    brand_search: 'Merek',
                    detail_barang_search: 'Barang',
                    metode_pembayaran: 'Metode',
                    ...(user?.role === 'super_admin' ? {
                      total_modal: 'Harga Modal',
                      total_jual: 'Harga Jual',
                      total_profit: 'Keuntungan',
                    } : {}),
                    total: 'Total',
                    create_by: 'Kasir'
                  }).map(([key, label]) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', userSelect: 'none', margin: 0, fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={visibleColumns[key] ?? true}
                        onChange={e => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                        style={{ cursor: 'pointer' }}
                        id={`chk-col-${key}`}
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

      {/* Detail Modal */}
      <Modal isOpen={dtlModal} onClose={() => { setDtlModal(false); setIsEditing(false); }} title={`Detail Invoice — ${selected?.nomor_invoice}`} size="lg"
        footer={
          isEditing ? (
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {isSuperAdmin && (
                  <>
                    <button className="btn btn-primary btn-outline" onClick={() => startEdit(selected!)}>✏️ Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(selected!.id)}>🗑️ Hapus</button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => handlePrint(selected!)} id="btn-reprint">🖨️ Cetak Ulang Struk</button>
                <button className="btn btn-outline" onClick={() => { setDtlModal(false); setIsEditing(false); }}>Tutup</button>
              </div>
            </div>
          )
        }
      >
        {selected && (
          <>
            {isEditing ? (
              <div className="form-grid" style={{ marginBottom: 16 }}>
                <div className="form-group">
                  <label className="form-label">Pelanggan</label>
                  <input type="text" className="form-control" value={editCustomer} onChange={e => setEditCustomer(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input type="datetime-local" className="form-control" value={editTanggal} onChange={e => setEditTanggal(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Metode Pembayaran</label>
                  <select className="form-control" value={editMetode} onChange={e => setEditMetode(e.target.value as MetodePembayaran)}>
                    <option value="Tunai">Tunai</option>
                    <option value="Debit">Debit</option>
                    <option value="Transfer">Transfer</option>
                    <option value="QRIS">QRIS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Kasir</label>
                  <input type="text" className="form-control" value={editKasir} onChange={e => setEditKasir(e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <div className="form-grid" style={{ marginBottom: 16 }}>
                  <div><div style={{ fontSize: 12, color: '#888' }}>Pelanggan</div><strong>{selected.customer}</strong></div>
                  <div><div style={{ fontSize: 12, color: '#888' }}>Tanggal</div><strong>{formatDateTime(selected.tanggal_penjualan)}</strong></div>
                  <div><div style={{ fontSize: 12, color: '#888' }}>Metode Pembayaran</div><strong>{selected.metode_pembayaran ?? 'Tunai'}</strong></div>
                  <div><div style={{ fontSize: 12, color: '#888' }}>Kasir</div><strong>{selected.create_by}</strong></div>
                </div>
                {selected.catatan && (
                  <div style={{ marginBottom: 16, background: '#f9f9f9', padding: '10px 14px', borderRadius: 6, borderLeft: '3px solid #1565c0' }}>
                    <div style={{ fontSize: 12, color: '#888' }}>Catatan Transaksi</div>
                    <strong style={{ fontSize: 13, color: '#333' }}>{selected.catatan}</strong>
                  </div>
                )}
              </>
            )}
            <table className="data-table">
              <thead>
                <tr><th>#</th><th>Barang</th><th>Kategori</th><th>Kode</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr>
              </thead>
              <tbody>
                {((selected as unknown as { trs_penjualan_dtl?: TrsPenjualanDtl[] }).trs_penjualan_dtl ?? []).map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td><strong>{d.nama_barang}</strong></td>
                    <td><span className="badge badge-info" style={{ fontSize: 10 }}>{d.kategori}</span></td>
                    <td><code style={{ fontSize: 10 }}>{d.code}</code></td>
                    <td>{d.qty}</td>
                    <td>{formatRupiah(d.harga_jual)}</td>
                    <td style={{ fontWeight: 600 }}>{formatRupiah(d.harga_jual * d.qty)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f0f4ff' }}>
                  <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL</td>
                  <td style={{ fontWeight: 700, color: '#1565c0', fontSize: 15 }}>{formatRupiah(selected.total_harga ?? 0)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </Modal>

      {selected && (
        <PrintReceipt
          invoiceNo={selected.nomor_invoice}
          customer={selected.customer}
          tanggalPenjualan={selected.tanggal_penjualan}
          metodePembayaran={selected.metode_pembayaran}
          items={((selected as unknown as { trs_penjualan_dtl?: TrsPenjualanDtl[] }).trs_penjualan_dtl ?? []).map(d => ({
            nama_barang: d.nama_barang,
            qty: d.qty,
            harga_jual: d.harga_jual,
            kategori: d.kategori,
            code: d.code,
          }))}
          total={selected.total_harga ?? 0}
        />
      )}
    </div>
  );
}
