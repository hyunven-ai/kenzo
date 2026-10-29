'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { searchBarcode, createPenjualan, searchProductsByName } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { formatRupiah, generateInvoiceNo, today } from '@/lib/utils';
import type { CartItem, MetodePembayaran } from '@/lib/types';
import PrintReceipt from '@/components/ui/PrintReceipt';
import BarcodeScannerModal from '@/components/ui/BarcodeScannerModal';
import NumericInput from '@/components/ui/NumericInput';
import { getPrinterSettings } from '@/lib/printerSettings';

const METODE_OPTIONS: MetodePembayaran[] = ['Tunai', 'Debit', 'Transfer', 'QRIS'];

const EWALLET_PROVIDERS = ['DANA', 'OVO', 'GoPay', 'ShopeePay', 'LinkAja', 'SAKUKU', 'i.saku'];
const EWALLET_NOMINALS = [
  { label: 'Rp 10.000', value: 10000 },
  { label: 'Rp 20.000', value: 20000 },
  { label: 'Rp 50.000', value: 50000 },
  { label: 'Rp 100.000', value: 100000 },
  { label: 'Rp 200.000', value: 200000 },
  { label: 'Rp 500.000', value: 500000 },
];
const EWALLET_ADMIN_FEE = 2000;

export default function PenjualanPage() {
  const user = getCurrentUser();
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState('Umum');
  const [tanggalTransaksi, setTanggalTransaksi] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [catatan, setCatatan] = useState('');
  const [metode, setMetode] = useState<MetodePembayaran>('Tunai');
  const [bayar, setBayar] = useState('');
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [lastInvoice, setLastInvoice] = useState('');
  const [printData, setPrintData] = useState<{
    invoiceNo: string;
    customer: string;
    tanggalPenjualan: string;
    metodePembayaran: string;
    items: CartItem[];
    total: number;
    bayar?: number;
  } | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // E-Wallet modal state
  const [ewalletModal, setEwalletModal] = useState(false);
  const [ewalletProvider, setEwalletProvider] = useState('DANA');
  const [ewalletPhone, setEwalletPhone] = useState('');
  const [ewalletNominal, setEwalletNominal] = useState(0);
  const [ewalletAdminFee, setEwalletAdminFee] = useState(EWALLET_ADMIN_FEE);
  const [ewalletIsCustom, setEwalletIsCustom] = useState(false);
  const [ewalletCustomNominal, setEwalletCustomNominal] = useState('');

  // Jasa Service modal state
  const [serviceModal, setServiceModal] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceModal_hargaModal, setServiceModal_hargaModal] = useState('');
  const [serviceModal_hargaJual, setServiceModal_hargaJual] = useState('');

  const handleInputChange = async (val: string) => {
    setBarcode(val);
    setSearchError('');
    if (val.trim().length >= 1) {
      try {
        const results = await searchProductsByName(val.trim());
        setSearchResults(results.slice(0, 10));
        setShowSuggestions(results.length > 0);
      } catch {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (item: any) => {
    const existing = cart.findIndex(c => c.code === item.code && c.kategori === item.kategori);
    if (existing >= 0) {
      if (cart[existing].qty >= (item.max_qty ?? 1)) {
        setSearchError(`Stok maksimal ${item.max_qty} unit`);
        return;
      }
      setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart(prev => [...prev, item]);
    }
    setBarcode('');
    setSearchResults([]);
    setShowSuggestions(false);
    barcodeRef.current?.focus();
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (showSuggestions && !document.getElementById('pos-barcode-container')?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showSuggestions]);

  const handleScanSuccess = async (scannedValue: string) => {
    if (!scannedValue.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      let result = await searchBarcode(scannedValue.trim());
      if (!result) {
        const matches = await searchProductsByName(scannedValue.trim());
        if (matches && matches.length > 0) {
          result = matches[0];
        }
      }
      if (!result) {
        setSearchError(`Barang dengan kode "${scannedValue}" tidak ditemukan atau stok habis`);
        return;
      }
      // Check if already in cart
      const existing = cart.findIndex(c => c.code === result.code && c.kategori === result.kategori);
      if (existing >= 0) {
        if (cart[existing].qty >= (result.max_qty ?? 1)) {
          setSearchError(`Stok maksimal ${result.max_qty} unit`);
          return;
        }
        setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
      } else {
        setCart(prev => [...prev, result]);
      }
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Gagal mencari barang');
    } finally {
      setSearching(false);
    }
  };

  // Auto focus barcode input
  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const total = cart.reduce((sum, item) => sum + item.harga_jual * item.qty, 0);
  const totalModal = cart.reduce((sum, item) => sum + item.harga_modal * item.qty, 0);
  const kembalian = parseInt(bayar || '0') - total;

  const handleBarcodeSearch = useCallback(async () => {
    if (!barcode.trim()) return;
    setSearching(true);
    setSearchError('');
    try {
      let result = await searchBarcode(barcode.trim());
      if (!result) {
        const matches = await searchProductsByName(barcode.trim());
        if (matches && matches.length > 0) {
          result = matches[0];
        }
      }
      if (!result) {
        setSearchError(`Barang dengan kata kunci "${barcode}" tidak ditemukan atau stok habis`);
        return;
      }
      // Check if already in cart
      const existing = cart.findIndex(c => c.code === result.code && c.kategori === result.kategori);
      if (existing >= 0) {
        if (cart[existing].qty >= (result.max_qty ?? 1)) {
          setSearchError(`Stok maksimal ${result.max_qty} unit`);
          return;
        }
        setCart(prev => prev.map((c, i) => i === existing ? { ...c, qty: c.qty + 1 } : c));
      } else {
        setCart(prev => [...prev, result]);
      }
      setBarcode('');
      setShowSuggestions(false);
      barcodeRef.current?.focus();
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'Gagal mencari barang');
    } finally {
      setSearching(false);
    }
  }, [barcode, cart]);

  const updateQty = (idx: number, qty: number) => {
    const item = cart[idx];
    if (qty < 1) { removeItem(idx); return; }
    if (qty > (item.max_qty ?? 99)) return;
    setCart(prev => prev.map((c, i) => i === idx ? { ...c, qty } : c));
  };

  const removeItem = (idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePrice = (idx: number, price: number) => {
    setCart(prev => prev.map((c, i) => i === idx ? { ...c, harga_jual: price } : c));
  };

  // ============ E-Wallet handler ============
  const openEwalletModal = () => {
    setEwalletProvider('DANA');
    setEwalletPhone('');
    setEwalletNominal(0);
    setEwalletAdminFee(EWALLET_ADMIN_FEE);
    setEwalletIsCustom(false);
    setEwalletCustomNominal('');
    setEwalletModal(true);
  };

  const handleAddEwallet = () => {
    const finalNominal = ewalletIsCustom ? (parseInt(ewalletCustomNominal) || 0) : ewalletNominal;
    if (!ewalletPhone.trim() || finalNominal === 0) {
      alert('Lengkapi nomor HP dan nominal top up');
      return;
    }
    const totalCharge = finalNominal + ewalletAdminFee;
    const item: CartItem = {
      idbarang: Date.now(),
      kategori: 'E-Wallet',
      code: `EW-${Date.now()}`,
      nama_barang: `Top Up ${ewalletProvider} ${ewalletPhone} — Rp ${finalNominal.toLocaleString('id-ID')}`,
      qty: 1,
      harga_modal: finalNominal,
      harga_jual: totalCharge,
      max_qty: 1,
    };
    setCart(prev => [...prev, item]);
    setEwalletModal(false);
    barcodeRef.current?.focus();
  };

  // ============ Jasa Service handler ============
  const openServiceModal = () => {
    setServiceName('');
    setServiceDesc('');
    setServiceModal_hargaModal('0');
    setServiceModal_hargaJual('0');
    setServiceModal(true);
  };

  const handleAddService = () => {
    if (!serviceName.trim()) {
      alert('Nama jasa service wajib diisi');
      return;
    }
    const hargaJual = parseInt(serviceModal_hargaJual) || 0;
    const hargaModal = parseInt(serviceModal_hargaModal) || 0;
    const namaLengkap = serviceDesc.trim()
      ? `${serviceName} — ${serviceDesc}`
      : serviceName;
    const item: CartItem = {
      idbarang: Date.now(),
      kategori: 'Jasa Service',
      code: `SVC-${Date.now()}`,
      nama_barang: namaLengkap,
      qty: 1,
      harga_modal: hargaModal,
      harga_jual: hargaJual,
      max_qty: 99,
    };
    setCart(prev => [...prev, item]);
    setServiceModal(false);
    barcodeRef.current?.focus();
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setProcessing(true);
    try {
      const invoiceNo = generateInvoiceNo();
      const now = new Date();
      const [year, month, day] = tanggalTransaksi.split('-').map(Number);
      const transactionDateTime = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());

      await createPenjualan(
        {
          nomor_invoice: invoiceNo,
          customer,
          status: 1,
          tanggal_penjualan: transactionDateTime.toISOString(),
          metode_pembayaran: metode,
          total_harga: total,
          catatan: catatan || undefined,
          create_by: user?.username ?? 'kasir',
        },
        cart.map(item => ({
          idbarang: item.idbarang,
          kategori: item.kategori,
          code: item.code,
          nama_barang: item.nama_barang,
          qty: item.qty,
          harga_modal: item.harga_modal,
          harga_jual: item.harga_jual,
          supplier: item.supplier,
          create_by: user?.username ?? 'kasir',
        }))
      );
      setLastInvoice(invoiceNo);
      setPrintData({
        invoiceNo,
        customer,
        tanggalPenjualan: transactionDateTime.toISOString(),
        metodePembayaran: metode,
        items: [...cart],
        total,
        bayar: bayar ? parseInt(bayar) : total,
      });
      setCheckoutModal(false);
      setSuccessModal(true);
      if (getPrinterSettings().autoPrint) {
        setTimeout(() => window.print(), 350);
      }
      setCart([]);
      setBayar('');
      setCustomer('Umum');
      const d = new Date();
      const yr = d.getFullYear();
      const mt = String(d.getMonth() + 1).padStart(2, '0');
      const dy = String(d.getDate()).padStart(2, '0');
      setTanggalTransaksi(`${yr}-${mt}-${dy}`);
      setCatatan('');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Gagal checkout');
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Kasir</h1>
          <p className="page-subtitle">{today()} | {user?.nama_lengkap}</p>
        </div>
        <Link 
          href="/pengaturan/printer" 
          className="btn btn-secondary" 
          style={{ fontSize: 13, gap: 6, textDecoration: 'none' }}
          title="Pengaturan Kertas & Struk Kasir"
        >
          <span>🖨️</span>
          <span>Pengaturan Printer</span>
        </Link>
      </div>

      <div className="pos-layout">
        {/* Left: Barcode search + item list */}
        <div className="pos-products">
          {/* Barcode Input */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--border-light, #2e2e36)', background: 'var(--bg-card, #1c1c22)' }} id="pos-barcode-container">
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="barcode-input-wrap" style={{ flex: 1, position: 'relative' }}>
                <input
                  ref={barcodeRef}
                  type="text"
                  className="form-control form-control-lg barcode-input"
                  placeholder="Ketik nama produk (misal: Kaos, Beras, Indomie) atau scan barcode..."
                  value={barcode}
                  onChange={e => handleInputChange(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleBarcodeSearch()}
                  id="pos-barcode-input"
                  autoFocus
                />
                {showSuggestions && searchResults.length > 0 && (
                  <div className="search-suggestions-dropdown" style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--bg-card, #1c1c22)',
                    border: '1px solid var(--border-light, #3f3f46)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    zIndex: 1000,
                    maxHeight: 280,
                    overflowY: 'auto',
                    marginTop: 4
                  }}>
                    {searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        style={{
                          padding: '10px 14px',
                          borderBottom: '1px solid var(--border-light, #2a2a32)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left'
                        }}
                        onClick={() => handleSelectSuggestion(item)}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary, #ffffff)' }}>{item.nama_barang}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary, #9ca3af)', marginTop: 2 }}>
                            <span className="badge badge-sm badge-info" style={{ marginRight: 6, fontSize: 9, padding: '2px 6px' }}>{item.kategori}</span>
                            <code>{item.code || 'Tanpa Barcode'}</code>
                            <span style={{ marginLeft: 8, color: '#22c55e', fontWeight: 600 }}>Stok: {item.max_qty}</span>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#f87171', fontSize: 14 }}>
                          {formatRupiah(item.harga_jual)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Camera scan button */}
              <button
                className="btn btn-outline btn-lg"
                onClick={() => setScannerOpen(true)}
                title="Scan menggunakan kamera"
                id="btn-camera-scan"
                style={{ flexShrink: 0, fontSize: 18, padding: '0 14px' }}
              >
                📷
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleBarcodeSearch}
                disabled={searching || !barcode.trim()}
                id="btn-scan"
                style={{ flexShrink: 0 }}
              >
                {searching ? <div className="spinner" style={{ width: 16, height: 16 }} /> : '🔍 Cari'}
              </button>
            </div>
            {searchError && (
              <div className="alert alert-error mt-8" style={{ padding: '8px 12px', fontSize: 12 }}>
                ⚠️ {searchError}
              </div>
            )}
          </div>

          {/* Quick-add service buttons */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', gap: 0 }}>
            <button
              onClick={openEwalletModal}
              id="btn-ewallet"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid var(--border-light)',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                fontSize: 12,
                padding: '9px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            >
              💳 Top Up E-Wallet
            </button>
            <button
              onClick={openServiceModal}
              id="btn-jasa-service"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                fontSize: 12,
                padding: '9px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-elevated)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            >
              🔧 Jasa Service
            </button>
          </div>

          {/* Cart items in main area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
            {cart.length === 0 ? (
              <div className="empty-state" style={{ height: '100%' }}>
                <div className="empty-state-icon" style={{ fontSize: 60 }}>🛒</div>
                <div className="empty-state-text">Keranjang kosong</div>
                <div style={{ fontSize: 12, color: '#bbb', marginTop: 8 }}>
                  Scan barcode atau ketik kode barang untuk menambah item
                </div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}>#</th>
                    <th>Barang</th>
                    <th style={{ width: 60 }}>Kat.</th>
                    <th style={{ width: 120 }}>Harga Satuan</th>
                    <th style={{ width: 110 }}>Qty</th>
                    <th style={{ width: 130 }}>Subtotal</th>
                    <th style={{ width: 50 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, idx) => (
                    <tr key={`${item.code}-${idx}`}>
                      <td className="text-muted text-sm">{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{item.nama_barang}</div>
                        <code style={{ fontSize: 10, color: '#999' }}>{item.code}</code>
                      </td>
                      <td>
                        <span className={`badge badge-sm ${
                          item.kategori === 'HP' ? 'badge-info' :
                          item.kategori === 'HP Non Pajak' ? 'badge-purple' :
                          item.kategori === 'Aksesoris' ? 'badge-success' :
                          item.kategori === 'CCTV' ? 'badge-warning' :
                          item.kategori === 'Sparepart' ? 'badge-teal' :
                          item.kategori === 'E-Wallet' ? 'badge-info' :
                          item.kategori === 'Jasa Service' ? 'badge-purple' : 'badge-gray'
                        }`} style={{ fontSize: 10 }}>
                          {item.kategori === 'HP Non Pajak' ? 'Non Pajak' :
                           item.kategori === 'Jasa Service' ? 'Service' :
                           item.kategori === 'E-Wallet' ? 'E-Wallet' :
                           item.kategori}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 12, color: '#888' }}>Rp</span>
                            <div style={{ width: 100 }}>
                              <NumericInput
                                className="form-control form-control-sm"
                                value={item.harga_jual}
                                onChange={(val) => updatePrice(idx, val)}
                                id={`pos-item-price-${idx}`}
                                style={item.harga_jual < item.harga_modal ? { borderColor: '#ef5350', color: '#ef5350', fontWeight: 'bold' } : undefined}
                              />
                            </div>
                          </div>
                          {item.harga_jual < item.harga_modal && (
                            <div style={{ color: '#ef5350', fontSize: '9px', fontWeight: 600, whiteSpace: 'nowrap' }} title={`Harga modal: ${formatRupiah(item.harga_modal)}`}>
                              Di bawah modal!
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => updateQty(idx, item.qty - 1)}
                            style={{ width: 28, height: 28, fontSize: 14 }}
                          >−</button>
                          <span style={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }}>
                            {item.qty}
                          </span>
                          <button
                            className="btn btn-outline btn-sm btn-icon"
                            onClick={() => updateQty(idx, item.qty + 1)}
                            disabled={item.qty >= (item.max_qty ?? 99)}
                            style={{ width: 28, height: 28, fontSize: 14 }}
                          >+</button>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: '#1565c0' }}>
                        {formatRupiah(item.harga_jual * item.qty)}
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm btn-icon"
                          onClick={() => removeItem(idx)}
                          style={{ width: 28, height: 28 }}
                          id={`btn-remove-${idx}`}
                        >✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Cart summary + checkout */}
        <div className="pos-cart">
          <div className="pos-cart-header">
            <div className="pos-cart-title">🧾 Ringkasan</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{cart.length} item</div>
          </div>

          <div className="pos-cart-items">
            {/* Customer */}
            <div className="form-group mb-12">
              <label className="form-label">Nama Pelanggan</label>
              <input
                type="text"
                className="form-control"
                value={customer}
                onChange={e => setCustomer(e.target.value)}
                placeholder="Nama pelanggan / Umum"
                id="pos-customer"
              />
            </div>

            {/* Tanggal Transaksi */}
            <div className="form-group mb-12">
              <label className="form-label">Tanggal Transaksi</label>
              <input
                type="date"
                className="form-control"
                value={tanggalTransaksi}
                onChange={e => setTanggalTransaksi(e.target.value)}
                id="pos-tanggal"
              />
            </div>

            {/* Catatan */}
            <div className="form-group mb-12">
              <label className="form-label">Catatan</label>
              <input
                type="text"
                className="form-control"
                value={catatan}
                onChange={e => setCatatan(e.target.value)}
                placeholder="Catatan transaksi..."
                id="pos-catatan"
              />
            </div>

            {/* Metode Pembayaran */}
            <div className="form-group mb-12">
              <label className="form-label">Metode Pembayaran</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                {METODE_OPTIONS.map(m => (
                  <button
                    key={m}
                    className={`btn ${metode === m ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setMetode(m)}
                    id={`btn-metode-${m.toLowerCase()}`}
                  >
                    {m === 'Tunai' ? '💵' : m === 'Debit' ? '💳' : m === 'Transfer' ? '🏦' : '📱'} {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Item summary */}
            <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 12 }}>
              {cart.slice(0, 4).map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: idx < Math.min(cart.length, 4) - 1 ? '1px solid #eee' : 'none' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                    {item.nama_barang} ×{item.qty}
                  </span>
                  <span style={{ fontWeight: 500 }}>{formatRupiah(item.harga_jual * item.qty)}</span>
                </div>
              ))}
              {cart.length > 4 && (
                <div style={{ fontSize: 11, color: '#999', textAlign: 'center', paddingTop: 6 }}>
                  +{cart.length - 4} item lainnya
                </div>
              )}
            </div>
          </div>

          <div className="pos-cart-footer">
            <div className="pos-total-row">
              <span className="text-muted">Subtotal</span>
              <span>{formatRupiah(total)}</span>
            </div>
            <div className="pos-total-row grand-total">
              <span>TOTAL</span>
              <span>{formatRupiah(total)}</span>
            </div>

            {metode === 'Tunai' && (
              <>
                <div className="form-group mt-12">
                  <label className="form-label">Uang Dibayar</label>
                  <NumericInput
                    className="form-control"
                    placeholder="0"
                    value={bayar}
                    onChange={(val, rawStr) => setBayar(rawStr)}
                    id="pos-bayar"
                  />
                </div>
                {bayar && (
                  <div className="pos-total-row mt-8" style={{ color: kembalian >= 0 ? '#2e7d32' : '#e53935', fontWeight: 600 }}>
                    <span>Kembalian</span>
                    <span>{formatRupiah(Math.max(0, kembalian))}</span>
                  </div>
                )}
              </>
            )}

            <button
              className="btn btn-success w-full mt-12"
              style={{ height: 46, fontSize: 15, fontWeight: 700 }}
              onClick={() => setCheckoutModal(true)}
              disabled={cart.length === 0}
              id="btn-checkout"
            >
              ✅ Proses Checkout ({cart.length} item)
            </button>

            {cart.length > 0 && (
              <button
                className="btn btn-outline w-full mt-8"
                style={{ color: '#e53935', borderColor: '#e53935' }}
                onClick={() => { if (confirm('Kosongkan keranjang?')) setCart([]); }}
                id="btn-clear-cart"
              >
                🗑️ Kosongkan Keranjang
              </button>
            )}
          </div>
        </div>
      </div>

      {/* E-Wallet Top Up Modal */}
      {ewalletModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">💳 Top Up E-Wallet</h2>
              <button className="modal-close" onClick={() => setEwalletModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-span-2">
                  <label className="form-label">Provider E-Wallet *</label>
                  <select
                    className="form-control"
                    value={ewalletProvider}
                    onChange={e => setEwalletProvider(e.target.value)}
                    id="ew-provider"
                  >
                    {EWALLET_PROVIDERS.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Nomor HP Tujuan *</label>
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="08xxxxxxxxxx"
                    value={ewalletPhone}
                    onChange={e => setEwalletPhone(e.target.value)}
                    id="ew-phone"
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Nominal Top Up *</label>
                  <select
                    className="form-control"
                    value={ewalletIsCustom ? 'custom' : ewalletNominal}
                    onChange={e => {
                      if (e.target.value === 'custom') {
                        setEwalletIsCustom(true);
                        setEwalletNominal(0);
                      } else {
                        setEwalletIsCustom(false);
                        setEwalletNominal(Number(e.target.value));
                      }
                    }}
                    id="ew-nominal"
                  >
                    <option value={0}>-- Pilih Nominal --</option>
                    {EWALLET_NOMINALS.map(n => (
                      <option key={n.value} value={n.value}>{n.label}</option>
                    ))}
                    <option value="custom">Nominal Kustom...</option>
                  </select>
                  {ewalletIsCustom && (
                    <NumericInput
                      className="form-control mt-8"
                      placeholder="Masukkan nominal kustom"
                      value={ewalletCustomNominal}
                      onChange={(val, rawStr) => setEwalletCustomNominal(rawStr)}
                      id="ew-custom-nominal"
                    />
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Biaya Admin (Ke Pelanggan)</label>
                  <NumericInput
                    className="form-control"
                    value={ewalletAdminFee}
                    onChange={val => setEwalletAdminFee(val)}
                    id="ew-admin-fee"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Tagihan</label>
                  <div
                    className="form-control"
                    style={{ background: 'var(--bg-elevated)', fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}
                  >
                    {formatRupiah((ewalletIsCustom ? (parseInt(ewalletCustomNominal) || 0) : ewalletNominal) + ewalletAdminFee)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setEwalletModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddEwallet} id="btn-confirm-ewallet">
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Jasa Service Modal */}
      {serviceModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">🔧 Jasa Service</h2>
              <button className="modal-close" onClick={() => setServiceModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group col-span-2">
                  <label className="form-label">Nama Jasa Service *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ganti LCD, Ganti Baterai, Software, dll."
                    value={serviceName}
                    onChange={e => setServiceName(e.target.value)}
                    id="svc-nama"
                    autoFocus
                  />
                </div>
                <div className="form-group col-span-2">
                  <label className="form-label">Deskripsi / Detail HP</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Detail pengerjaan / imei / keluhan pelanggan..."
                    value={serviceDesc}
                    onChange={e => setServiceDesc(e.target.value)}
                    id="svc-desc"
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Modal (Biaya Part)</label>
                  <NumericInput
                    className="form-control"
                    placeholder="0"
                    value={serviceModal_hargaModal}
                    onChange={(val, rawStr) => setServiceModal_hargaModal(rawStr)}
                    id="svc-modal"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga Jual (Total Biaya) *</label>
                  <NumericInput
                    className="form-control"
                    placeholder="0"
                    value={serviceModal_hargaJual}
                    onChange={(val, rawStr) => setServiceModal_hargaJual(rawStr)}
                    id="svc-jual"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setServiceModal(false)}>Batal</button>
              <button className="btn btn-primary" onClick={handleAddService} id="btn-confirm-service">
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Confirmation Modal */}
      {checkoutModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h2 className="modal-title">Konfirmasi Checkout</h2>
              <button className="modal-close" onClick={() => setCheckoutModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ background: '#f8f9fa', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Detail Transaksi</div>
                {cart.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0' }}>
                    <span>{item.nama_barang} ×{item.qty}</span>
                    <span style={{ fontWeight: 500 }}>{formatRupiah(item.harga_jual * item.qty)}</span>
                  </div>
                ))}
                <hr className="divider" />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>TOTAL</span>
                  <span style={{ color: '#1565c0' }}>{formatRupiah(total)}</span>
                </div>
              </div>
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#888' }}>Pelanggan</div>
                  <div style={{ fontWeight: 600 }}>{customer}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#888' }}>Metode</div>
                  <div style={{ fontWeight: 600 }}>{metode}</div>
                </div>
                {metode === 'Tunai' && bayar && (
                  <>
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>Bayar</div>
                      <div style={{ fontWeight: 600 }}>{formatRupiah(parseInt(bayar))}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#888' }}>Kembalian</div>
                      <div style={{ fontWeight: 600, color: '#2e7d32' }}>{formatRupiah(Math.max(0, kembalian))}</div>
                    </div>
                  </>
                )}
              </div>
              {catatan && (
                <div style={{ marginTop: 10, borderTop: '1px solid #eee', paddingTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#888' }}>Catatan</div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{catatan}</div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCheckoutModal(false)}>Batal</button>
              <button className="btn btn-success" onClick={handleCheckout} disabled={processing} id="btn-confirm-checkout">
                {processing ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Memproses...</> : '✅ Konfirmasi & Bayar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModal && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="modal-body" style={{ padding: 40 }}>
              <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
              <h2 style={{ fontFamily: 'Outfit', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Transaksi Berhasil!</h2>
              <p style={{ color: '#888', fontSize: 13 }}>No. Invoice: <strong>{lastInvoice}</strong></p>
              <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>Total: <strong style={{ color: '#1565c0' }}>{formatRupiah(printData?.total ?? 0)}</strong></p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline w-full" onClick={handlePrint} id="btn-print-receipt">🖨️ Cetak Struk</button>
                <button className="btn btn-primary w-full" onClick={() => { setSuccessModal(false); barcodeRef.current?.focus(); }} id="btn-close-success">
                  Transaksi Baru
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {printData && (
        <PrintReceipt
          invoiceNo={printData.invoiceNo}
          customer={printData.customer}
          tanggalPenjualan={printData.tanggalPenjualan}
          metodePembayaran={printData.metodePembayaran}
          items={printData.items}
          total={printData.total}
          bayar={printData.bayar}
        />
      )}

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
