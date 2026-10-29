'use client';

import { useState, useEffect, useMemo, useTransition } from 'react';
import Link from 'next/link';
import BarcodeGenerator from '@/components/ui/BarcodeGenerator';
import PrintBarcodeLabel, { LabelPrintItem } from '@/components/ui/PrintBarcodeLabel';
import Modal from '@/components/ui/Modal';
import { getBarangs, getKategoris } from '@/lib/db';
import { formatRupiah } from '@/lib/utils';
import {
  BarcodeLabelSettings,
  BARCODE_LABEL_PRESETS,
  DEFAULT_BARCODE_LABEL_SETTINGS,
  getBarcodeLabelSettings,
  saveBarcodeLabelSettings,
} from '@/lib/barcodeSettings';
import type { MsBarang, MsKategori } from '@/lib/types';

export default function BarcodePage() {
  const [items, setItems] = useState<MsBarang[]>([]);
  const [categories, setCategories] = useState<MsKategori[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('semua');
  const [filterStok, setFilterStok] = useState<'semua' | 'ada' | 'habis'>('semua');

  // Selected items map: { id: boolean }
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});
  // Custom print qty per item: { id: number }
  const [printQuantities, setPrintQuantities] = useState<Record<number, number>>({});

  // Label Settings state
  const [settings, setSettings] = useState<BarcodeLabelSettings>(DEFAULT_BARCODE_LABEL_SETTINGS);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [singlePrintItem, setSinglePrintItem] = useState<MsBarang | null>(null);

  // Active print queue for physical printing
  const [printQueue, setPrintQueue] = useState<LabelPrintItem[]>([]);
  const [, startTransition] = useTransition();

  const loadData = async () => {
    setLoading(true);
    try {
      const [barangsData, katsData] = await Promise.all([
        getBarangs(),
        getKategoris(),
      ]);
      setItems(barangsData);
      setCategories(katsData);

      // Initialize print quantities matching stock count or default 1
      const initialQtys: Record<number, number> = {};
      barangsData.forEach(b => {
        initialQtys[b.id] = Math.max(1, b.qty || 1);
      });
      setPrintQuantities(initialQtys);
    } catch (err) {
      console.error('Gagal memuat produk barcode:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSettings(getBarcodeLabelSettings());
    loadData();
  }, []);

  // Filtered product items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = search.toLowerCase();
      const matchSearch =
        !search.trim() ||
        (item.nama && item.nama.toLowerCase().includes(q)) ||
        (item.barcode && item.barcode.toLowerCase().includes(q)) ||
        (item.kategori && item.kategori.toLowerCase().includes(q)) ||
        (item.merk && item.merk.toLowerCase().includes(q));

      const matchKat = selectedKategori === 'semua' || item.kategori === selectedKategori;
      const matchStok =
        filterStok === 'semua' ||
        (filterStok === 'ada' && (item.qty || 0) > 0) ||
        (filterStok === 'habis' && (item.qty || 0) <= 0);

      return matchSearch && matchKat && matchStok;
    });
  }, [items, search, selectedKategori, filterStok]);

  // Total summary calculation
  const totalProducts = items.length;
  const totalStock = items.reduce((acc, cur) => acc + (cur.qty || 0), 0);

  // Selected items count
  const selectedCount = Object.values(selectedIds).filter(Boolean).length;
  const totalLabelsSelected = useMemo(() => {
    let count = 0;
    items.forEach(item => {
      if (selectedIds[item.id]) {
        count += printQuantities[item.id] || 1;
      }
    });
    return count;
  }, [items, selectedIds, printQuantities]);

  const toggleSelectAll = (checked: boolean) => {
    const updated: Record<number, boolean> = {};
    if (checked) {
      filteredItems.forEach(i => {
        updated[i.id] = true;
      });
    }
    setSelectedIds(updated);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setQty = (id: number, val: number) => {
    setPrintQuantities(prev => ({ ...prev, [id]: Math.max(1, Math.min(999, val)) }));
  };

  const handleApplyPreset = (presetId: string) => {
    const preset = BARCODE_LABEL_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const updated = {
      ...settings,
      presetId,
      widthMm: preset.widthMm,
      heightMm: preset.heightMm,
    };
    setSettings(updated);
    saveBarcodeLabelSettings(updated);
  };

  const handleUpdateSetting = <K extends keyof BarcodeLabelSettings>(key: K, val: BarcodeLabelSettings[K]) => {
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    saveBarcodeLabelSettings(updated);
  };

  // Trigger Print for Single Item
  const handlePrintSingle = (item: MsBarang) => {
    setSinglePrintItem(item);
    const qty = printQuantities[item.id] || 1;
    const queue: LabelPrintItem[] = [{
      id: item.id,
      barcode: item.barcode || `KZ-${item.id}`,
      nama: item.nama,
      harga_jual: item.harga_jual || 0,
      kategori: item.kategori,
      warna: item.warna,
      ukuran: item.ukuran,
      qtyPrint: qty,
    }];
    setPrintQueue(queue);
    setPreviewModalOpen(true);
  };

  // Trigger Print for Batch Selected Items
  const handlePrintSelected = () => {
    const queue: LabelPrintItem[] = [];
    items.forEach(item => {
      if (selectedIds[item.id]) {
        queue.push({
          id: item.id,
          barcode: item.barcode || `KZ-${item.id}`,
          nama: item.nama,
          harga_jual: item.harga_jual || 0,
          kategori: item.kategori,
          warna: item.warna,
          ukuran: item.ukuran,
          qtyPrint: printQuantities[item.id] || 1,
        });
      }
    });

    if (queue.length === 0) {
      alert('Pilih minimal 1 produk terlebih dahulu.');
      return;
    }

    setSinglePrintItem(null);
    setPrintQueue(queue);
    setPreviewModalOpen(true);
  };

  const executeThermalPrint = () => {
    setPreviewModalOpen(false);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Preview target sample item
  const previewSample = singlePrintItem || printQueue[0] || filteredItems[0] || {
    barcode: 'BJ-KAOS-001',
    nama: 'Kaos Polos Cotton Combed 30s Hitam',
    harga_jual: 65000,
    ukuran: 'XL',
    warna: 'Hitam',
  };

  return (
    <div>
      {/* Header Page */}
      <div className="page-header">
        <div>
          <h1 className="page-title">🏷️ Database & Cetak Label Barcode</h1>
          <p className="page-subtitle">
            Cetak stiker barcode thermal roll (40x30mm & ukuran kustom) untuk produk toko kelontong & baju
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSettingsModalOpen(true)}
            id="btn-label-settings"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <span>⚙️</span>
            <span>Format Label ({settings.widthMm}×{settings.heightMm}mm)</span>
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={handlePrintSelected}
            disabled={selectedCount === 0}
            id="btn-print-batch-top"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <span>🖨️</span>
            <span>Cetak Terpilih ({selectedCount} Produk / {totalLabelsSelected} Label)</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14, marginBottom: 20 }}>
        <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, background: 'rgba(59, 130, 246, 0.1)', padding: 10, borderRadius: 10 }}>📦</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Total Produk Barcode</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{totalProducts} Produk</div>
          </div>
        </div>

        <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, background: 'rgba(34, 197, 94, 0.1)', padding: 10, borderRadius: 10 }}>🏷️</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Stok Fisik Tersedia</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{totalStock} Unit</div>
          </div>
        </div>

        <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, background: 'rgba(245, 158, 11, 0.1)', padding: 10, borderRadius: 10 }}>🖨️</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ukuran Label Aktif</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{settings.widthMm} × {settings.heightMm} mm</div>
            <span className="badge badge-info" style={{ fontSize: 10, padding: '2px 6px', marginTop: 2 }}>Thermal Roll</span>
          </div>
        </div>

        <div className="card card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 32, background: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 10 }}>📑</div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Label Tercentang</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: selectedCount > 0 ? '#4ade80' : 'var(--text-muted)' }}>
              {totalLabelsSelected} Stiker
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card mb-16">
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Cari barcode, nama produk, kode SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="search-barcode-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                >
                  ✕
                </button>
              )}
            </div>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 160 }}
              value={selectedKategori}
              onChange={e => setSelectedKategori(e.target.value)}
              id="filter-kategori-select"
            >
              <option value="semua">Semua Kategori</option>
              {categories.map(k => (
                <option key={k.id} value={k.nama}>{k.nama}</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', minWidth: 140 }}
              value={filterStok}
              onChange={e => setFilterStok(e.target.value as any)}
              id="filter-stok-select"
            >
              <option value="semua">Semua Stok</option>
              <option value="ada">Stok Ada (&gt;0)</option>
              <option value="habis">Stok Habis (0)</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                const updated: Record<number, boolean> = {};
                filteredItems.filter(i => (i.qty || 0) > 0).forEach(i => { updated[i.id] = true; });
                setSelectedIds(updated);
              }}
              title="Centang semua produk yang memiliki stok > 0"
            >
              ✓ Pilih Stok &gt; 0
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedIds({})}
              disabled={selectedCount === 0}
              title="Batalkan semua pilihan"
            >
              ✕ Lepas Pilihan
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Products Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="card-title">📦 Daftar Kode Barcode & Stok Produk ({filteredItems.length})</span>
          {selectedCount > 0 && (
            <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>
              {selectedCount} barang dipilih ({totalLabelsSelected} lembar label)
            </span>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 44, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={filteredItems.length > 0 && filteredItems.every(i => selectedIds[i.id])}
                    onChange={e => toggleSelectAll(e.target.checked)}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                    title="Pilih Semua"
                  />
                </th>
                <th style={{ width: 190, textAlign: 'center' }}>Preview Visual Barcode</th>
                <th style={{ width: 160 }}>Kode Barcode</th>
                <th>Nama Produk & Varian</th>
                <th style={{ width: 130 }}>Kategori</th>
                <th style={{ width: 120 }}>Harga Jual</th>
                <th style={{ width: 90, textAlign: 'center' }}>Stok</th>
                <th style={{ width: 120, textAlign: 'center' }}>Qty Cetak</th>
                <th style={{ width: 130, textAlign: 'center' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                    <div className="spinner" style={{ margin: '0 auto 10px' }} />
                    Memuat katalog barcode produk...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                    Tidak ada produk yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isSelected = Boolean(selectedIds[item.id]);
                  const qtyPrint = printQuantities[item.id] || 1;
                  const variantInfo = [item.ukuran, item.warna].filter(Boolean).join(' • ');

                  return (
                    <tr
                      key={item.id}
                      style={{ background: isSelected ? 'rgba(34, 197, 94, 0.05)' : undefined }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          style={{ cursor: 'pointer', width: 16, height: 16 }}
                        />
                      </td>

                      {/* Visual Barcode SVG Preview */}
                      <td style={{ textAlign: 'center', padding: '6px 8px', background: 'var(--bg-main, #141416)' }}>
                        <div style={{ background: '#ffffff', padding: '4px 6px', borderRadius: 4, display: 'inline-block' }}>
                          <BarcodeGenerator
                            value={item.barcode || `KZ-${item.id}`}
                            format={settings.barcodeFormat}
                            height={28}
                            width={1.25}
                            displayValue={false}
                          />
                        </div>
                      </td>

                      {/* Barcode String */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <code style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>
                            {item.barcode || `KZ-${item.id}`}
                          </code>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ padding: '2px 6px', fontSize: 10, height: 22 }}
                            onClick={() => {
                              navigator.clipboard.writeText(item.barcode || `KZ-${item.id}`);
                              alert('Barcode disalin!');
                            }}
                            title="Salin kode barcode"
                          >
                            📋
                          </button>
                        </div>
                      </td>

                      {/* Nama Produk */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                          {item.nama}
                        </div>
                        {variantInfo && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                            {variantInfo}
                          </div>
                        )}
                      </td>

                      {/* Kategori */}
                      <td>
                        <span className="badge badge-info" style={{ fontSize: 11 }}>
                          {item.kategori || 'Umum'}
                        </span>
                      </td>

                      {/* Harga Jual */}
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatRupiah(item.harga_jual || 0)}
                      </td>

                      {/* Stok */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`badge ${(item.qty || 0) > 0 ? 'badge-success' : 'badge-error'}`}
                          style={{ fontWeight: 700 }}
                        >
                          {item.qty || 0}
                        </span>
                      </td>

                      {/* Input Qty Cetak */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={999}
                          value={qtyPrint}
                          onChange={e => setQty(item.id, parseInt(e.target.value) || 1)}
                          style={{ width: 70, textAlign: 'center', margin: '0 auto', padding: '4px 6px', height: 32 }}
                          title="Jumlah stiker yang akan dicetak"
                        />
                      </td>

                      {/* Aksi Print Satuan */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handlePrintSingle(item)}
                          style={{ fontSize: 12, padding: '5px 10px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title="Cetak label produk ini"
                        >
                          <span>🖨️</span>
                          <span>Cetak</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bottom Action Bar if Items are selected */}
      {selectedCount > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-elevated, #24242c)',
          border: '1px solid var(--border-medium, #3f3f46)',
          borderRadius: 12,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
          zIndex: 100,
          maxWidth: '92vw',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {selectedCount} produk terpilih
            </div>
            <div style={{ fontSize: 12, color: '#4ade80' }}>
              Total {totalLabelsSelected} lembar stiker barcode siap cetak
            </div>
          </div>
          <button
            type="button"
            className="btn btn-success"
            onClick={handlePrintSelected}
            style={{ fontWeight: 700, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>🖨️</span>
            <span>Cetak {totalLabelsSelected} Stiker Label</span>
          </button>
        </div>
      )}

      {/* Modal Format & Ukuran Label Barcode */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="⚙️ Pengaturan Format & Ukuran Label Barcode Thermal"
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSettingsModalOpen(false)}
          >
            Selesai & Simpan
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Preset Buttons */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>
              Pilih Ukuran Stiker Thermal Roll:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {BARCODE_LABEL_PRESETS.map(preset => {
                const isActive = settings.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1.5px solid ${isActive ? '#22c55e' : 'var(--border-medium)'}`,
                      background: isActive ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-card)',
                      color: isActive ? '#4ade80' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{preset.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{preset.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Dimension Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Lebar Label (mm)</label>
              <input
                type="number"
                className="form-control"
                value={settings.widthMm}
                onChange={e => {
                  const w = parseInt(e.target.value) || 10;
                  handleUpdateSetting('widthMm', w);
                  handleUpdateSetting('presetId', 'custom');
                }}
                min={20}
                max={110}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tinggi Label (mm)</label>
              <input
                type="number"
                className="form-control"
                value={settings.heightMm}
                onChange={e => {
                  const h = parseInt(e.target.value) || 10;
                  handleUpdateSetting('heightMm', h);
                  handleUpdateSetting('presetId', 'custom');
                }}
                min={15}
                max={150}
              />
            </div>
          </div>

          {/* Nama Toko */}
          <div className="form-group">
            <label className="form-label">Nama Toko di Label</label>
            <input
              type="text"
              className="form-control"
              value={settings.shopName}
              onChange={e => handleUpdateSetting('shopName', e.target.value)}
              placeholder="Contoh: Kenzo Store"
            />
          </div>

          {/* Opsi Tampilan Elemen */}
          <div>
            <label className="form-label" style={{ fontWeight: 700, marginBottom: 8, display: 'block' }}>
              Elemen yang Ditampilkan pada Stiker:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-elevated)', padding: 12, borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showShopName}
                  onChange={e => handleUpdateSetting('showShopName', e.target.checked)}
                />
                <span>Tampilkan Nama Toko ({settings.shopName || 'Nama Toko'})</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showItemName}
                  onChange={e => handleUpdateSetting('showItemName', e.target.checked)}
                />
                <span>Tampilkan Nama Produk & Varian (Warna/Ukuran)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showBarcodeText}
                  onChange={e => handleUpdateSetting('showBarcodeText', e.target.checked)}
                />
                <span>Tampilkan Teks Kode Barcode di bawah garis barcode</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={settings.showPrice}
                  onChange={e => handleUpdateSetting('showPrice', e.target.checked)}
                />
                <span>Tampilkan Harga Jual (Rp xx.xxx)</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Preview & Cetak Thermal Label */}
      <Modal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="🖨️ Preview Label Barcode Sebelum Cetak"
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPreviewModalOpen(false)}
            >
              Batal
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setSettingsModalOpen(true)}
              >
                ⚙️ Ubah Ukuran ({settings.widthMm}×{settings.heightMm}mm)
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={executeThermalPrint}
                style={{ fontWeight: 700, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 6 }}
                id="btn-confirm-print-thermal"
              >
                <span>🖨️</span>
                <span>Cetak ke Printer Thermal</span>
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
            Preview tampilan stiker ukuran <strong>{settings.widthMm} × {settings.heightMm} mm</strong> (Rasio Thermal Roll):
          </div>

          {/* Authentic Thermal Label Sticker Preview */}
          <div style={{
            background: '#ffffff',
            color: '#000000',
            width: `${Math.min(300, settings.widthMm * 5.2)}px`,
            minHeight: `${settings.heightMm * 5.2}px`,
            border: '2px dashed #9ca3af',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxSizing: 'border-box',
          }}>
            {settings.showShopName && settings.shopName && (
              <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                {settings.shopName}
              </div>
            )}

            {settings.showItemName && (
              <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, marginBottom: 4, maxHeight: 32, overflow: 'hidden' }}>
                {previewSample.nama} {previewSample.ukuran ? `(${previewSample.ukuran})` : ''}
              </div>
            )}

            <div style={{ width: '100%', margin: '4px 0', display: 'flex', justifyContent: 'center' }}>
              <BarcodeGenerator
                value={previewSample.barcode || 'KZ-SAMPLE'}
                format={settings.barcodeFormat}
                width={1.4}
                height={32}
                displayValue={false}
              />
            </div>

            {settings.showBarcodeText && (
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
                {previewSample.barcode || 'KZ-SAMPLE'}
              </div>
            )}

            {settings.showPrice && previewSample.harga_jual > 0 && (
              <div style={{ fontSize: 14, fontWeight: 800, color: '#000000', marginTop: 2 }}>
                {formatRupiah(previewSample.harga_jual)}
              </div>
            )}
          </div>

          <div className="alert alert-info" style={{ width: '100%', fontSize: 12, padding: '10px 14px' }}>
            💡 <strong>Rincian Antrean Cetak:</strong> {printQueue.length} produk berbeda, total{' '}
            <strong>{printQueue.reduce((acc, cur) => acc + (cur.qtyPrint || 1), 0)} lembar stiker</strong> thermal.
            Pada dialog cetak browser, pastikan ukuran kertas diatur ke <strong>{settings.widthMm}mm × {settings.heightMm}mm</strong> dan Margin diatur ke <strong>None</strong>.
          </div>
        </div>
      </Modal>

      {/* Dedicated Invisible Print Stage Component */}
      <PrintBarcodeLabel
        items={printQueue}
        settingsOverride={settings}
      />
    </div>
  );
}
