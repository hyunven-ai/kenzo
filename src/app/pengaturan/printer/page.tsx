'use client';

import { useState, useEffect, useRef } from 'react';
import {
  getPrinterSettings,
  savePrinterSettings,
  resetPrinterSettings,
  addPrinterDevice,
  removePrinterDevice,
  setDefaultPrinterDevice,
  PrinterSettings,
  PrinterDevice,
  PrinterConnectionType,
  DEFAULT_PRINTER_SETTINGS
} from '@/lib/printerSettings';
import PrintReceipt from '@/components/ui/PrintReceipt';
import Modal from '@/components/ui/Modal';

export default function PrinterSettingsPage() {
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [activeTab, setActiveTab] = useState<'devices' | 'receipt'>('devices');
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);
  const [testPrintActive, setTestPrintActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Modal Tambah Printer
  const [modalOpen, setModalOpen] = useState(false);
  const [stepModal, setStepModal] = useState<'select_type' | 'form'>('select_type');
  const [selectedType, setSelectedType] = useState<PrinterConnectionType>('bluetooth');

  // Form printer baru
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterAddress, setNewPrinterAddress] = useState('');
  const [newPrinterPort, setNewPrinterPort] = useState(9100);
  const [newPrinterPaper, setNewPrinterPaper] = useState<'58mm' | '80mm'>('58mm');
  const [newPrinterIsDefault, setNewPrinterIsDefault] = useState(true);
  const [scanningBluetooth, setScanningBluetooth] = useState(false);
  const [bluetoothError, setBluetoothError] = useState<string | null>(null);

  const refreshSettings = () => {
    setSettings(getPrinterSettings());
  };

  useEffect(() => {
    refreshSettings();
    const handleUpdate = () => refreshSettings();
    window.addEventListener('printer-settings-updated', handleUpdate);
    return () => window.removeEventListener('printer-settings-updated', handleUpdate);
  }, []);

  const handleChange = (field: keyof PrinterSettings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = () => {
    savePrinterSettings(settings);
    setSavedSuccess('Pengaturan struk berhasil disimpan!');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleReset = () => {
    if (confirm('Apakah Anda yakin ingin mengembalikan semua pengaturan printer ke bawaan standar?')) {
      const def = resetPrinterSettings();
      setSettings(def);
      setSavedSuccess('Pengaturan berhasil direset ke default!');
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('File harus berupa gambar (PNG, JPG, WEBP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 300;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setSettings(prev => ({ ...prev, logoUrl: dataUrl, showLogo: true }));
          savePrinterSettings({ logoUrl: dataUrl, showLogo: true });
          setSavedSuccess('Logo struk berhasil diupload!');
          setTimeout(() => setSavedSuccess(null), 3000);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleResetLogoToDefault = () => {
    setSettings(prev => ({ ...prev, logoUrl: '/logo-struk.png' }));
    savePrinterSettings({ logoUrl: '/logo-struk.png' });
    setSavedSuccess('Logo dikembalikan ke bawaan standar!');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleRemoveLogo = () => {
    if (confirm('Hapus logo dari struk dan sembunyikan tampilan logo?')) {
      setSettings(prev => ({ ...prev, logoUrl: '', showLogo: false }));
      savePrinterSettings({ logoUrl: '', showLogo: false });
      setSavedSuccess('Logo struk berhasil dihapus!');
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const handleOpenAddModal = () => {
    setStepModal('select_type');
    setSelectedType('bluetooth');
    setNewPrinterName('');
    setNewPrinterAddress('');
    setNewPrinterPort(9100);
    setNewPrinterPaper('58mm');
    setNewPrinterIsDefault(settings.devices.length === 0);
    setBluetoothError(null);
    setModalOpen(true);
  };

  const handleSelectType = (type: PrinterConnectionType) => {
    setSelectedType(type);
    if (type === 'bluetooth') {
      setNewPrinterName('RPP02N');
    } else if (type === 'network') {
      setNewPrinterName('Printer Kasir LAN');
      setNewPrinterAddress('192.168.1.200');
    } else {
      setNewPrinterName('POS-58 (USB Driver)');
    }
    setStepModal('form');
  };

  // Web Bluetooth Scan
  const handleScanBluetooth = async () => {
    setBluetoothError(null);
    setScanningBluetooth(true);
    try {
      if (!(navigator as any).bluetooth) {
        setBluetoothError('Browser ini belum mendukung Web Bluetooth secara langsung. Anda dapat memasukkan nama printer manual (misal: RPP02N atau POS-58).');
        return;
      }
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        ],
      });
      if (device && device.name) {
        setNewPrinterName(device.name);
        setNewPrinterAddress(device.id || 'Bluetooth Paired');
      }
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setBluetoothError(err.message || 'Gagal memindai perangkat Bluetooth.');
      }
    } finally {
      setScanningBluetooth(false);
    }
  };

  const handleSaveNewPrinter = () => {
    if (!newPrinterName.trim()) {
      alert('Nama printer wajib diisi.');
      return;
    }

    addPrinterDevice({
      name: newPrinterName.trim(),
      connectionType: selectedType,
      paperWidth: newPrinterPaper,
      targetAddress: newPrinterAddress.trim() || undefined,
      port: selectedType === 'network' ? newPrinterPort : undefined,
      isDefault: newPrinterIsDefault,
      status: 'ready',
    });

    setModalOpen(false);
    setSavedSuccess(`Printer "${newPrinterName}" berhasil ditambahkan!`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleDeleteDevice = (id: string, name: string) => {
    if (confirm(`Hapus printer "${name}" dari daftar?`)) {
      removePrinterDevice(id);
      setSavedSuccess(`Printer "${name}" dihapus.`);
      setTimeout(() => setSavedSuccess(null), 3000);
    }
  };

  const handleSetDefaultDevice = (id: string, name: string) => {
    setDefaultPrinterDevice(id);
    setSavedSuccess(`Printer "${name}" sekarang menjadi printer utama.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleTestPrint = (deviceName?: string) => {
    setTestPrintActive(true);
    setTimeout(() => {
      window.print();
      setTimeout(() => setTestPrintActive(false), 1000);
    }, 200);
  };

  const activeDevice = settings.devices.find(d => d.id === settings.activeDeviceId) || settings.devices[0];

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="page-title">Pengaturan Printer & Perangkat Kasir</h1>
          <p className="page-subtitle">
            Kelola printer Bluetooth, Wi-Fi/LAN, dan USB serta sesuaikan identitas struk belanja.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleReset}
          >
            🔄 Reset ke Default
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenAddModal}
            style={{ fontWeight: 600, background: '#e53935' }}
          >
            ➕ Tambah Printer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        borderBottom: '1px solid var(--border-light)',
        marginBottom: 20
      }}>
        <button
          type="button"
          onClick={() => setActiveTab('devices')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'devices' ? '#e53935' : 'var(--text-secondary)',
            borderBottom: activeTab === 'devices' ? '2px solid #e53935' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>🖨️</span>
          <span>Daftar Printer ({settings.devices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('receipt')}
          style={{
            padding: '10px 18px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            color: activeTab === 'receipt' ? '#e53935' : 'var(--text-secondary)',
            borderBottom: activeTab === 'receipt' ? '2px solid #e53935' : '2px solid transparent',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>📄</span>
          <span>Format & Identitas Struk</span>
        </button>
      </div>

      {savedSuccess && (
        <div style={{
          background: 'rgba(46, 125, 50, 0.15)',
          border: '1px solid rgba(46, 125, 50, 0.4)',
          color: '#4caf50',
          padding: '12px 16px',
          borderRadius: 8,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 14,
          fontWeight: 600
        }}>
          <span>✅</span> {savedSuccess}
        </div>
      )}

      {/* TAB 1: PERANGKAT PRINTER */}
      {activeTab === 'devices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Status summary banner */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: settings.devices.length > 0 ? 'rgba(46, 125, 50, 0.15)' : 'var(--bg-card-hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22
              }}>
                {settings.devices.length > 0 ? '🖨️' : '🔌'}
              </div>
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Status Printer Utama:</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {activeDevice ? (
                    <span style={{ color: '#4caf50' }}>
                      Terhubung: {activeDevice.name} ({activeDevice.paperWidth})
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-secondary)' }}>Belum ada printer terhubung</span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenAddModal}
              style={{ background: '#e53935', fontWeight: 600 }}
            >
              ➕ Tambah Printer
            </button>
          </div>

          {/* List or Empty State */}
          {settings.devices.length === 0 ? (
            /* EMPTY STATE LIKE USER SCREENSHOT */
            <div className="card" style={{ padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Illustrated Printer Icon matching screenshot 2 */}
              <div style={{
                width: 120,
                height: 120,
                background: 'var(--bg-card-hover)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                border: '1px solid var(--border-light)'
              }}>
                <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                  <circle cx="18" cy="13" r="1" fill="var(--text-primary)" />
                  <line x1="9" y1="17" x2="15" y2="17" />
                  <line x1="9" y1="19" x2="13" y2="19" />
                </svg>
              </div>

              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Belum ada printer ditambahkan
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', maxWidth: 460, marginBottom: 24, lineHeight: 1.55 }}>
                Hubungkan printer thermal kasir via Bluetooth, Wi-Fi / LAN, atau kabel USB driver untuk mencetak struk kasir secara otomatis.
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleOpenAddModal}
                style={{
                  background: '#e53935',
                  padding: '10px 28px',
                  height: 'auto',
                  fontSize: 14,
                  fontWeight: 700,
                  borderRadius: 8,
                  boxShadow: '0 4px 12px rgba(229,57,53,0.3)'
                }}
              >
                Tambah Printer
              </button>
            </div>
          ) : (
            /* LIST OF ADDED PRINTERS */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {settings.devices.map(device => (
                <div
                  key={device.id}
                  className="card"
                  style={{
                    border: device.isDefault ? '2px solid #4caf50' : '1px solid var(--border-light)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {device.isDefault && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      background: '#4caf50',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderBottomLeftRadius: 6,
                      textTransform: 'uppercase',
                      letterSpacing: 0.5
                    }}>
                      ⭐ Default (Utama)
                    </div>
                  )}

                  <div className="card-body" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        background: device.connectionType === 'bluetooth' ? 'rgba(37, 99, 235, 0.15)' : device.connectionType === 'network' ? 'rgba(22, 163, 74, 0.15)' : 'rgba(147, 51, 234, 0.15)',
                        color: device.connectionType === 'bluetooth' ? '#3b82f6' : device.connectionType === 'network' ? '#22c55e' : '#a855f7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 22,
                        flexShrink: 0
                      }}>
                        {device.connectionType === 'bluetooth' ? 'ᛒ' : device.connectionType === 'network' ? '📶' : '🔌'}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: 2 }}>
                          {device.name}
                        </h3>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>
                            {device.connectionType === 'bluetooth' ? 'Bluetooth' : device.connectionType === 'network' ? 'Wi-Fi / LAN' : 'USB / Driver'}
                          </span>
                          <span>•</span>
                          <span className="badge badge-info" style={{ fontSize: 10 }}>{device.paperWidth}</span>
                        </div>
                        {device.targetAddress && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, fontFamily: 'monospace' }}>
                            {device.targetAddress}{device.port ? `:${device.port}` : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-light)', marginTop: 14, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleTestPrint(device.name)}
                        style={{ fontSize: 12, height: 32, padding: '0 10px' }}
                      >
                        🖨️ Test Cetak
                      </button>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {!device.isDefault && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => handleSetDefaultDevice(device.id, device.name)}
                            style={{ fontSize: 12, height: 32, padding: '0 10px' }}
                            title="Jadikan printer utama"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          style={{ fontSize: 12, height: 32, padding: '0 8px', color: '#e53935' }}
                          title="Hapus printer"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick General Preferences */}
          <div className="card" style={{ marginTop: 10 }}>
            <div className="card-header">
              <span className="card-title">⚙️ Preferensi Cetak Transaksi</span>
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.autoPrint}
                  onChange={e => {
                    handleChange('autoPrint', e.target.checked);
                    savePrinterSettings({ autoPrint: e.target.checked });
                  }}
                  style={{ width: 18, height: 18, cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cetak Otomatis (Auto-Print)</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Buka dialog cetak otomatis saat checkout transaksi kasir selesai</div>
                </div>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Jumlah Rangkap Struk:</span>
                <select
                  className="form-control"
                  style={{ width: 140 }}
                  value={settings.printCopies}
                  onChange={e => {
                    const c = Number(e.target.value);
                    handleChange('printCopies', c);
                    savePrinterSettings({ printCopies: c });
                  }}
                >
                  <option value={1}>1 Rangkap</option>
                  <option value={2}>2 Rangkap</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FORMAT & IDENTITAS STRUK */}
      {activeTab === 'receipt' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(350px, 1.2fr) minmax(320px, 0.8fr)',
          gap: 24,
          alignItems: 'start'
        }}>
          {/* Form settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Ukuran Kertas */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📐 Ukuran Kertas Default</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <label style={{
                    border: settings.paperWidth === '58mm' ? '2px solid #e53935' : '1px solid var(--border-light)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    background: settings.paperWidth === '58mm' ? 'rgba(229,57,53,0.08)' : 'var(--bg-card)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name="paperWidth"
                        value="58mm"
                        checked={settings.paperWidth === '58mm'}
                        onChange={() => handleChange('paperWidth', '58mm')}
                      />
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>58 mm (POS-58)</strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 24 }}>
                      Standar printer kasir mini/thermal (lebar print 48mm).
                    </span>
                  </label>

                  <label style={{
                    border: settings.paperWidth === '80mm' ? '2px solid #e53935' : '1px solid var(--border-light)',
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    cursor: 'pointer',
                    background: settings.paperWidth === '80mm' ? 'rgba(229,57,53,0.08)' : 'var(--bg-card)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="radio"
                        name="paperWidth"
                        value="80mm"
                        checked={settings.paperWidth === '80mm'}
                        onChange={() => handleChange('paperWidth', '80mm')}
                      />
                      <strong style={{ fontSize: 14, color: 'var(--text-primary)' }}>80 mm (POS-80)</strong>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 24 }}>
                      Printer kasir ukuran sedang/lebar (lebar print 72mm).
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Identitas Toko & Logo Struk */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">🏪 Identitas Toko & Logo di Struk</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Opsi Tampilkan Logo & Box CRUD Logo */}
                <div style={{
                  background: 'var(--bg-elevated, #24242c)',
                  border: '1px solid var(--border-light, #2e2e36)',
                  borderRadius: 8,
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  {/* Toggle Tampilkan Logo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={settings.showLogo}
                        onChange={e => handleChange('showLogo', e.target.checked)}
                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                        id="checkbox-show-logo"
                      />
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                          Tampilkan Logo di Bagian Atas Struk
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {settings.showLogo ? 'Logo aktif dan akan dicetak pada struk' : 'Logo disembunyikan (struk hanya menampilkan teks nama toko)'}
                        </div>
                      </div>
                    </label>

                    <span className={`badge ${settings.showLogo ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: 10 }}>
                      {settings.showLogo ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>

                  {/* Panel Kelola (CRUD) Logo */}
                  <div style={{
                    borderTop: '1px solid var(--border-light, #2a2a32)',
                    paddingTop: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}>
                    {/* Thumbnail Preview */}
                    <div style={{
                      width: 76,
                      height: 76,
                      borderRadius: 8,
                      background: '#ffffff',
                      border: '2px solid var(--border-light, #3f3f46)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 4,
                      flexShrink: 0,
                      position: 'relative',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                    }}>
                      {(settings.logoUrl || '/logo-struk.png') ? (
                        <img
                          src={settings.logoUrl || '/logo-struk.png'}
                          alt="Logo Preview"
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                      ) : (
                        <span style={{ fontSize: 10, color: '#999', textAlign: 'center' }}>Tanpa Logo</span>
                      )}
                    </div>

                    {/* Controls & Status */}
                    <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Status Logo:</span>
                        <span className={`badge badge-sm ${settings.logoUrl && settings.logoUrl !== '/logo-struk.png' ? 'badge-primary' : 'badge-info'}`} style={{ fontSize: 9 }}>
                          {settings.logoUrl && settings.logoUrl !== '/logo-struk.png' ? '🎨 Custom Logo Toko' : '🏷️ Logo Standar'}
                        </span>
                      </div>

                      {/* Action buttons (CRUD) */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                        <input
                          type="file"
                          ref={logoInputRef}
                          accept="image/png, image/jpeg, image/jpg, image/webp"
                          style={{ display: 'none' }}
                          onChange={handleLogoUpload}
                          id="file-input-logo"
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => logoInputRef.current?.click()}
                          style={{ fontSize: 11, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
                          id="btn-upload-logo"
                        >
                          📷 {settings.logoUrl && settings.logoUrl !== '/logo-struk.png' ? 'Ganti Logo' : 'Upload Logo Baru'}
                        </button>

                        {settings.logoUrl && settings.logoUrl !== '/logo-struk.png' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleResetLogoToDefault}
                            style={{ fontSize: 11, padding: '5px 10px' }}
                            title="Kembalikan ke logo standar"
                            id="btn-reset-logo"
                          >
                            🔄 Reset Logo Standar
                          </button>
                        )}

                        {settings.logoUrl && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={handleRemoveLogo}
                            style={{ fontSize: 11, padding: '5px 10px', color: '#ef5350', borderColor: '#ef5350' }}
                            title="Hapus logo dari struk"
                            id="btn-remove-logo"
                          >
                            🗑️ Hapus Logo
                          </button>
                        )}
                      </div>

                      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                        Format disarankan: PNG transparan atau JPG monokrom (rasio persegi, otomatis dioptimasi).
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nama Toko</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.shopName}
                    onChange={e => handleChange('shopName', e.target.value)}
                    placeholder="Kenzo / Nama Toko Anda"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Alamat Baris 1</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.addressLine1}
                      onChange={e => handleChange('addressLine1', e.target.value)}
                      placeholder="Jalan Pasar Beringin no.05"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Alamat Baris 2</label>
                    <input
                      type="text"
                      className="form-control"
                      value={settings.addressLine2}
                      onChange={e => handleChange('addressLine2', e.target.value)}
                      placeholder="SUNGAI PINYUH"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nomor WhatsApp Toko</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.whatsappNumber}
                    onChange={e => handleChange('whatsappNumber', e.target.value)}
                    placeholder="0812-5866-6628"
                  />
                </div>
              </div>
            </div>

            {/* Media Sosial */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📱 Media Sosial di Struk</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showSocialMedia}
                    onChange={e => handleChange('showSocialMedia', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Tampilkan baris ikon media sosial</span>
                </label>

                {settings.showSocialMedia && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Akun Facebook</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={settings.facebookName}
                        onChange={e => handleChange('facebookName', e.target.value)}
                        placeholder="MArr LinDa&#10;Vierry Kien'z"
                        style={{ height: 'auto', minHeight: 60 }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label">Akun Instagram</label>
                        <input
                          type="text"
                          className="form-control"
                          value={settings.instagramName}
                          onChange={e => handleChange('instagramName', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Akun TikTok</label>
                        <input
                          type="text"
                          className="form-control"
                          value={settings.tiktokName}
                          onChange={e => handleChange('tiktokName', e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Catatan & Footer */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">📝 Catatan & Footer Struk</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={settings.showImei}
                    onChange={e => handleChange('showImei', e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Cetak nomor IMEI untuk barang HP</span>
                </label>

                <div className="form-group">
                  <label className="form-label">Pesan Kebijakan / Garansi</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.warningNote}
                    onChange={e => handleChange('warningNote', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Teks Penutup Struk (Footer)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={settings.footerNote}
                    onChange={e => handleChange('footerNote', e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveSettings}
                  style={{ marginTop: 10, fontWeight: 600 }}
                >
                  💾 Simpan Perubahan Format Struk
                </button>
              </div>
            </div>

          </div>

          {/* Preview Column */}
          <div style={{ position: 'sticky', top: 20 }}>
            <div className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-title">👁️ Live Preview Struk</span>
                <span className="badge badge-info" style={{ fontSize: 11 }}>
                  Format {settings.paperWidth}
                </span>
              </div>
              <div className="card-body" style={{ background: '#334155', borderRadius: '0 0 8px 8px', padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* Paper Simulation Wrapper */}
                <div style={{
                  background: '#ffffff',
                  color: '#000000',
                  width: settings.paperWidth === '80mm' ? '300px' : '230px',
                  padding: '16px 12px',
                  borderRadius: 4,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                  fontFamily: 'Inter, Arial, sans-serif',
                  fontSize: settings.paperWidth === '80mm' ? '12px' : '10.5px',
                  lineHeight: 1.35,
                  boxSizing: 'border-box'
                }}>
                  {settings.showLogo && Boolean(settings.logoUrl || '/logo-struk.png') && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                      <img
                        src={settings.logoUrl || '/logo-struk.png'}
                        alt="Logo Struk"
                        style={{ maxWidth: settings.paperWidth === '80mm' ? 65 : 52, maxHeight: settings.paperWidth === '80mm' ? 65 : 52, objectFit: 'contain' }}
                      />
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: settings.paperWidth === '80mm' ? '16px' : '14px', margin: '2px 0' }}>
                      {settings.shopName || 'Kenzo'}
                    </div>
                    {settings.addressLine1 && <div style={{ fontSize: 10, color: '#111' }}>{settings.addressLine1}</div>}
                    {settings.addressLine2 && <div style={{ fontSize: 10, color: '#111' }}>{settings.addressLine2}</div>}

                    {settings.whatsappNumber && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
                        <img src="/icon-wa.png" alt="WA" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                        <span style={{ fontWeight: 700, fontSize: 10.5 }}>{settings.whatsappNumber}</span>
                      </div>
                    )}

                    {settings.showSocialMedia && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {settings.facebookName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <img src="/icon-fb.png" alt="FB" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                            <div style={{ fontSize: 7.5, fontWeight: 700, textAlign: 'left', lineHeight: 1.15, whiteSpace: 'pre-line' }}>
                              {settings.facebookName}
                            </div>
                          </div>
                        )}
                        {settings.instagramName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <img src="/icon-ig.png" alt="IG" style={{ width: 11, height: 11, objectFit: 'contain' }} />
                            <span style={{ fontSize: 7.5, fontWeight: 700 }}>{settings.instagramName}</span>
                          </div>
                        )}
                        {settings.tiktokName && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 10 }}>🎵</span>
                            <span style={{ fontSize: 7.5, fontWeight: 700 }}>{settings.tiktokName}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600 }}>
                    <span>26 Okt 2026, 17.30</span>
                    <span>#721</span>
                  </div>
                  <div style={{ fontSize: 9.5, marginTop: 2 }}>Pembeli: Umum</div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 10.5 }}>1. TECNO SPARK 50 4/128G</div>
                      {settings.showImei && (
                        <div style={{ fontSize: 9, fontWeight: 'bold', paddingLeft: 6, color: '#111' }}>
                          IMEI: 350008871828041
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, paddingLeft: 6, fontWeight: 600 }}>
                        <span>1x 2.799.000</span>
                        <span>2.799.000</span>
                      </div>
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: 10.5 }}>2. FOOMEEE CAS 12W MICRO</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, paddingLeft: 6, fontWeight: 600 }}>
                        <span>1x 70.000</span>
                        <span>70.000</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

                  <div style={{ fontSize: 9.5, fontWeight: 600 }}>
                    <div>Produk: 2</div>
                    <div>Item: 2</div>
                  </div>

                  <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 12 }}>
                    <span>Total</span>
                    <span>Rp 2.869.000</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 600, marginTop: 2 }}>
                    <span>Tunai</span>
                    <span>Rp 2.869.000</span>
                  </div>

                  {settings.warningNote && (
                    <div style={{
                      border: '1px solid #000',
                      padding: '3px 2px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: 8.5,
                      marginTop: 8,
                      lineHeight: 1.2
                    }}>
                      {settings.warningNote}
                    </div>
                  )}

                  {settings.footerNote && (
                    <div style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      textDecoration: 'underline',
                      fontStyle: 'italic',
                      marginTop: 8,
                      fontSize: 10
                    }}>
                      {settings.footerNote}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 20, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleTestPrint()}
                    style={{ width: '100%', height: 42, fontSize: 14, fontWeight: 700, background: '#e53935' }}
                  >
                    🖨️ Test Cetak Struk Fisik
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TAMBAH PRINTER (MATCHING USER SCREENSHOTS 2, 3, 4) */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={stepModal === 'select_type' ? 'Pilih Jenis Printer' : `Tambah Printer ${selectedType === 'bluetooth' ? 'Bluetooth' : selectedType === 'network' ? 'Wi-Fi / LAN' : 'USB / Driver'}`}
      >
        {stepModal === 'select_type' ? (
          /* STEP 1: PILIH JENIS PRINTER (MATCHING SCREENSHOT 3) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '10px 0' }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Pilih metode koneksi printer thermal yang ingin Anda hubungkan:
            </div>

            {/* Option: Bluetooth */}
            <div
              onClick={() => handleSelectType('bluetooth')}
              style={{
                border: '1px solid var(--border-medium)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: 'var(--bg-card-hover)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#e53935';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(37, 99, 235, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                flexShrink: 0
              }}>
                ᛒ
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  Bluetooth
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Printer thermal nirkabel portabel (contoh: RPP02N, PT-210, POS-58 Bluetooth)
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 700 }}>›</div>
            </div>

            {/* Option: WIFI / LAN */}
            <div
              onClick={() => handleSelectType('network')}
              style={{
                border: '1px solid var(--border-medium)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: 'var(--bg-card-hover)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#e53935';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(22, 163, 74, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                flexShrink: 0
              }}>
                📶
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  WIFI / LAN
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Printer jaringan kabel LAN atau Wi-Fi via IP Address
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 700 }}>›</div>
            </div>

            {/* Option: USB / Driver Sistem */}
            <div
              onClick={() => handleSelectType('usb')}
              style={{
                border: '1px solid var(--border-medium)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: 'var(--bg-card-hover)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#e53935';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border-medium)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(147, 51, 234, 0.15)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 700,
                flexShrink: 0
              }}>
                🔌
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                  USB / Driver Sistem (Windows)
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Printer kabel USB yang terpasang di driver Windows (contoh: POS-58, Epson TM-T82)
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 20, fontWeight: 700 }}>›</div>
            </div>
          </div>
        ) : (
          /* STEP 2: FORM DETAIL PRINTER SESUAI TIPE (MATCHING SCREENSHOT 4) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>

            {/* Bluetooth Scanner Action */}
            {selectedType === 'bluetooth' && (
              <div style={{
                background: 'var(--bg-card-hover)',
                border: '1px solid var(--border-medium)',
                borderRadius: 8,
                padding: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    ᛒ Pindai Perangkat Bluetooth Sekitar:
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleScanBluetooth}
                    disabled={scanningBluetooth}
                    style={{ fontSize: 12, height: 32, gap: 6 }}
                  >
                    {scanningBluetooth ? '🔍 Memindai...' : '🔍 Cari Perangkat'}
                  </button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Pastikan printer thermal Bluetooth Anda (misal RPP02N) sudah dinyalakan dan Bluetooth di perangkat Anda aktif.
                </div>

                {bluetoothError && (
                  <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '8px 12px', borderRadius: 6 }}>
                    ⚠️ {bluetoothError}
                  </div>
                )}
              </div>
            )}

            {/* Nama Printer */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                Nama Perangkat Printer <span style={{ color: '#e53935' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                value={newPrinterName}
                onChange={e => setNewPrinterName(e.target.value)}
                placeholder="Contoh: RPP02N / POS-58"
              />
              {selectedType === 'bluetooth' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>Pilihan cepat:</span>
                  {['RPP02N', 'POS-58', 'MPT-II', 'PT-210'].map(model => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setNewPrinterName(model)}
                      style={{
                        background: 'var(--bg-card-hover)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-medium)',
                        borderRadius: 4,
                        padding: '2px 8px',
                        fontSize: 11.5,
                        cursor: 'pointer'
                      }}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Network IP & Port */}
            {selectedType === 'network' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>IP Address Printer</label>
                  <input
                    type="text"
                    className="form-control"
                    value={newPrinterAddress}
                    onChange={e => setNewPrinterAddress(e.target.value)}
                    placeholder="192.168.1.200"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Port</label>
                  <input
                    type="number"
                    className="form-control"
                    value={newPrinterPort}
                    onChange={e => setNewPrinterPort(Number(e.target.value))}
                    placeholder="9100"
                  />
                </div>
              </div>
            )}

            {/* Ukuran Kertas */}
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ukuran Kertas Printer</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label style={{
                  border: newPrinterPaper === '58mm' ? '2px solid #e53935' : '1px solid var(--border-medium)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  background: newPrinterPaper === '58mm' ? 'rgba(229,57,53,0.1)' : 'var(--bg-card-hover)'
                }}>
                  <input
                    type="radio"
                    name="newPaper"
                    value="58mm"
                    checked={newPrinterPaper === '58mm'}
                    onChange={() => setNewPrinterPaper('58mm')}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>58 mm (POS-58)</span>
                </label>

                <label style={{
                  border: newPrinterPaper === '80mm' ? '2px solid #e53935' : '1px solid var(--border-medium)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  background: newPrinterPaper === '80mm' ? 'rgba(229,57,53,0.1)' : 'var(--bg-card-hover)'
                }}>
                  <input
                    type="radio"
                    name="newPaper"
                    value="80mm"
                    checked={newPrinterPaper === '80mm'}
                    onChange={() => setNewPrinterPaper('80mm')}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>80 mm (POS-80)</span>
                </label>
              </div>
            </div>

            {/* Set as Default Switch */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
              <input
                type="checkbox"
                checked={newPrinterIsDefault}
                onChange={e => setNewPrinterIsDefault(e.target.checked)}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Jadikan printer ini sebagai printer utama (default)</span>
            </label>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStepModal('select_type')}
              >
                ← Kembali
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveNewPrinter}
                  style={{ background: '#e53935', fontWeight: 600 }}
                >
                  Simpan & Hubungkan
                </button>
              </div>
            </div>

          </div>
        )}
      </Modal>

      {/* Hidden dummy PrintReceipt component triggered during test print */}
      {testPrintActive && (
        <PrintReceipt
          invoiceNo="INV/261026/0721"
          customer="Umum"
          tanggalPenjualan={new Date().toISOString()}
          metodePembayaran="Tunai"
          total={2869000}
          bayar={2869000}
          invoiceIndex={721}
          items={[
            {
              nama_barang: 'TECNO SPARK 50 4/128G',
              qty: 1,
              harga_jual: 2799000,
              kategori: 'HP',
              code: '350008871828041',
            },
            {
              nama_barang: 'FOOMEEE CAS 12W MICRO',
              qty: 1,
              harga_jual: 70000,
              kategori: 'Aksesoris',
            },
          ]}
        />
      )}
    </div>
  );
}
