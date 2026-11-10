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
  const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
  const [settings, setSettings] = useState<PrinterSettings>(() => {
    if (typeof window !== 'undefined') {
      return getPrinterSettings();
    }
    return DEFAULT_PRINTER_SETTINGS;
  });

  useEffect(() => {
    if (!mounted) setMounted(true);
    setSettings(getPrinterSettings());

    const handleUpdate = () => {
      setSettings(getPrinterSettings());
    };
    window.addEventListener('printer-settings-updated', handleUpdate);
    return () => {
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

  // Format date identical to ESC/POS: DD/MM/YYYY HH:mm
  const d = new Date(tanggalPenjualan);
  const formattedDate = !isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : String(tanggalPenjualan);

  const cleanBayar = bayar !== undefined ? bayar : total;
  const kembalian = cleanBayar - total;

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        @media print {
          @page {
            size: ${settings.paperWidth === '80mm' ? '80mm' : '58mm'} auto;
            margin: 0;
          }
        }
      `}</style>
      <div
        className={`print-receipt-container ${settings.paperWidth === '80mm' ? 'paper-80mm' : 'paper-58mm'}`}
        style={{
          '--receipt-margin-left': `${settings.receiptMarginLeftMm ?? 3.6}mm`,
          '--receipt-width': `${settings.receiptWidthMm ?? 42.5}mm`,
        } as React.CSSProperties}
      >
        {/* Header */}
        <div className="receipt-header">
          {settings.showLogo && Boolean(settings.logoUrl) && (
            <img
              src={settings.logoUrl}
              alt="Logo Struk"
              className="receipt-logo"
            />
          )}

          <div className="receipt-shop-name">{settings.shopName || 'Kenzo'}</div>
          {settings.addressLine1 && <div className="receipt-shop-address">{settings.addressLine1}</div>}
          {settings.addressLine2 && <div className="receipt-shop-address">{settings.addressLine2}</div>}

          {/* WhatsApp Text */}
          {settings.whatsappNumber && (
            <div className="receipt-shop-wa">
              WA: {settings.whatsappNumber}
            </div>
          )}

          {/* Social Media Text */}
          {settings.showSocialMedia && (
            <div className="receipt-social-container">
              {settings.facebookName && (
                <div>FB: {settings.facebookName.replace(/\n/g, ' / ')}</div>
              )}
              {settings.instagramName && (
                <div>IG: {settings.instagramName}</div>
              )}
              {settings.tiktokName && (
                <div>TikTok: {settings.tiktokName}</div>
              )}
            </div>
          )}
        </div>

        <div className="receipt-divider"></div>

        {/* Informasi Transaksi */}
        <div className="receipt-meta-section">
          <div className="receipt-two-cols">
            <span>{formattedDate}</span>
            <span>{displayIndex}</span>
          </div>
          <div>Pembeli: {customer || 'Umum'}</div>
          {invoiceNo && <div>No. Inv: {invoiceNo}</div>}
        </div>

        <div className="receipt-divider"></div>

        {/* Daftar Barang */}
        <div className="receipt-items">
          {items.map((item, index) => {
            const cleanName = item.nama_barang.replace(/\s*\(Non Pajak\)/gi, '');
            return (
              <div key={index} className="receipt-item-row">
                <div className="receipt-item-title">
                  {index + 1}. {cleanName}
                </div>
                {settings.showImei && (item.kategori === 'HP' || item.kategori === 'HP Non Pajak') && item.code && (
                  <div className="receipt-item-imei">
                    &nbsp;&nbsp;&nbsp;IMEI: {item.code}
                  </div>
                )}
                <div className="receipt-two-cols receipt-item-details">
                  <span>&nbsp;&nbsp;&nbsp;{item.qty}x {item.harga_jual.toLocaleString('id-ID')}</span>
                  <span>{(item.qty * item.harga_jual).toLocaleString('id-ID')}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="receipt-divider"></div>

        {/* Ringkasan Qty */}
        <div className="receipt-two-cols receipt-summary">
          <span>Produk: {productCount}</span>
          <span>Total Qty: {totalQty}</span>
        </div>

        {/* Total & Pembayaran */}
        <div className="receipt-totals">
          <div className="receipt-two-cols receipt-total-large">
            <span>TOTAL:</span>
            <span>Rp {total.toLocaleString('id-ID')}</span>
          </div>
          <div className="receipt-two-cols">
            <span>Bayar:</span>
            <span>Rp {cleanBayar.toLocaleString('id-ID')}</span>
          </div>
          {kembalian > 0 && (
            <div className="receipt-two-cols">
              <span>Kembali:</span>
              <span>Rp {kembalian.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="receipt-two-cols">
            <span>Metode:</span>
            <span>{metodePembayaran}</span>
          </div>
        </div>

        <div className="receipt-divider"></div>

        {/* Footer & Kebijakan */}
        {settings.warningNote && (
          <div className="receipt-warning-text">
            {settings.warningNote}
          </div>
        )}

        {settings.footerNote && (
          <div className="receipt-footer-text">
            {settings.footerNote}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
