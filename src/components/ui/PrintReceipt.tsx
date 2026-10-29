'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatRupiah, formatDateTime } from '@/lib/utils';
import { getPrinterSettings, PrinterSettings, DEFAULT_PRINTER_SETTINGS } from '@/lib/printerSettings';

interface PrintReceiptProps {
  invoiceNo: string;
  customer: string;
  tanggalPenjualan: string;
  metodePembayaran?: string;
  items: Array<{
    nama_barang: string;
    qty: number;
    harga_jual: number;
    kategori?: string;
    code?: string;
  }>;
  total: number;
  bayar?: number;
  invoiceIndex?: number; // Optional sequential invoice number, e.g., #19
}

export default function PrintReceipt({
  invoiceNo,
  customer,
  tanggalPenjualan,
  metodePembayaran = 'Tunai',
  items,
  total,
  bayar,
  invoiceIndex,
}: PrintReceiptProps) {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);

  useEffect(() => {
    setMounted(true);
    setSettings(getPrinterSettings());

    const handleUpdate = () => {
      setSettings(getPrinterSettings());
    };
    window.addEventListener('printer-settings-updated', handleUpdate);
    return () => {
      setMounted(false);
      window.removeEventListener('printer-settings-updated', handleUpdate);
    };
  }, []);

  // Calculate unique product count and total quantity
  const productCount = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);

  // Extract sequential invoice number from INV/YYMMDD/XXXX pattern if no index is given
  const displayIndex = invoiceIndex !== undefined
    ? `#${invoiceIndex}`
    : invoiceNo ? `#${invoiceNo.split('/').pop()?.replace(/^0+/, '') || invoiceNo}` : '';

  const cleanBayar = bayar !== undefined ? bayar : total;
  const kembalian = cleanBayar - total;

  if (!mounted) return null;

  return createPortal(
    <div className={`print-receipt-container ${settings.paperWidth === '80mm' ? 'paper-80mm' : 'paper-58mm'}`}>
      {/* Logo & Header */}
      <div className="receipt-header">
        {settings.showLogo && Boolean(settings.logoUrl || '/logo-struk.png') && (
          <img
            src={settings.logoUrl || '/logo-struk.png'}
            alt="Logo Struk"
            className="receipt-logo"
            style={{ maxWidth: '65px', maxHeight: '65px', objectFit: 'contain', marginBottom: '4px' }}
          />
        )}

        <h1 className="receipt-shop-name">{settings.shopName || 'Kenzo'}</h1>
        {settings.addressLine1 && <p className="receipt-shop-address">{settings.addressLine1}</p>}
        {settings.addressLine2 && <p className="receipt-shop-address">{settings.addressLine2}</p>}

        {/* WhatsApp Row */}
        {settings.whatsappNumber && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 4 }}>
            <img src="/icon-wa.png" alt="WhatsApp" className="receipt-social-icon" style={{ width: '14px', height: '14px', objectFit: 'contain', flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: 11.5 }}>{settings.whatsappNumber}</span>
          </div>
        )}

        {/* Social Media Grid */}
        {settings.showSocialMedia && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, width: '100%' }}>
            {/* Facebook */}
            {settings.facebookName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <img src="/icon-fb.png" alt="Facebook" className="receipt-social-icon" style={{ width: '17px', height: '17px', objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.15, fontSize: 8, fontWeight: 700, whiteSpace: 'pre-line' }}>
                  {settings.facebookName.split('\n').map((line, idx) => (
                    <span key={idx}>{line}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Instagram */}
            {settings.instagramName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <img src="/icon-ig.png" alt="Instagram" className="receipt-social-icon" style={{ width: '12px', height: '12px', objectFit: 'contain', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 8 }}>{settings.instagramName}</span>
              </div>
            )}

            {/* TikTok */}
            {settings.tiktokName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <svg viewBox="0 0 24 24" width="13" height="13" fill="#000000">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.52-4.06-1.41-.45-.34-.84-.74-1.19-1.19v7.54c.04 3.44-1.89 6.81-5.18 7.91-3.28 1.14-7.23-.33-8.81-3.37-1.58-3.05-.72-7.27 2-9.25 1.99-1.48 4.79-1.78 7.03-.76v4.35c-1.42-.87-3.37-.62-4.52.54-1.15 1.15-1.19 3.16-.1 4.41.98 1.18 2.8 1.51 4.15.77 1.04-.54 1.63-1.63 1.6-2.82V0l.03.02z" />
                </svg>
                <span style={{ fontWeight: 700, fontSize: 8 }}>{settings.tiktokName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="receipt-meta">
        <span>{formatDateTime(tanggalPenjualan)}</span>
        <span>{displayIndex}</span>
      </div>
      <div className="receipt-meta" style={{ marginTop: 2 }}>
        <span>Pembeli: {customer || 'Umum'}</span>
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-items">
        {items.map((item, index) => (
          <div key={index} className="receipt-item-row">
            <div className="receipt-item-title">
              {index + 1}. {item.nama_barang.replace(/\s*\(Non Pajak\)/gi, '')}
            </div>
            {settings.showImei && (item.kategori === 'HP' || item.kategori === 'HP Non Pajak') && item.code && (
              <div className="receipt-item-imei" style={{ fontSize: '10px', color: '#000', fontWeight: 'bold', paddingLeft: '6px', marginTop: '-1px', marginBottom: '1px', whiteSpace: 'pre-line', wordBreak: 'break-all' }}>
                IMEI: {item.code}
              </div>
            )}
            <div className="receipt-item-details">
              <span>{item.qty}x {item.harga_jual.toLocaleString('id-ID')}</span>
              <span>{(item.qty * item.harga_jual).toLocaleString('id-ID')}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-summary">
        <div className="receipt-summary-row">
          <span>Produk: {productCount}</span>
        </div>
        <div className="receipt-summary-row">
          <span>Item: {totalQty}</span>
        </div>
      </div>

      <div className="receipt-divider"></div>

      <div className="receipt-totals">
        <div className="receipt-total-row bold">
          <span>Total</span>
          <span>{formatRupiah(total)}</span>
        </div>
        <div className="receipt-total-row">
          <span>{metodePembayaran}</span>
          <span>{formatRupiah(cleanBayar)}</span>
        </div>
        {metodePembayaran === 'Tunai' && kembalian > 0 && (
          <div className="receipt-total-row">
            <span>Kembalian</span>
            <span>{formatRupiah(kembalian)}</span>
          </div>
        )}
      </div>

      {settings.warningNote && (
        <div className="receipt-warning-box" style={{ border: '1px solid #000000', padding: '3px 2px', textAlign: 'center', fontWeight: 'bold', fontSize: '9px', marginTop: '10px', boxSizing: 'border-box' }}>
          {settings.warningNote}
        </div>
      )}

      {settings.footerNote && (
        <div className="receipt-footer" style={{ textDecoration: 'underline', fontStyle: 'italic', marginTop: '10px' }}>
          {settings.footerNote}
        </div>
      )}
    </div>,
    document.body
  );
}
