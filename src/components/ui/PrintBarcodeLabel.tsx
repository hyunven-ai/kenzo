'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BarcodeGenerator from './BarcodeGenerator';
import { formatRupiah } from '@/lib/utils';
import { BarcodeLabelSettings, DEFAULT_BARCODE_LABEL_SETTINGS, getBarcodeLabelSettings } from '@/lib/barcodeSettings';

export interface LabelPrintItem {
  id?: number | string;
  barcode: string;
  nama: string;
  harga_jual: number;
  kategori?: string;
  warna?: string;
  ukuran?: string;
  qtyPrint: number;
}

interface PrintBarcodeLabelProps {
  items: LabelPrintItem[];
  settingsOverride?: Partial<BarcodeLabelSettings>;
}

export default function PrintBarcodeLabel({
  items,
  settingsOverride,
}: PrintBarcodeLabelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted || items.length === 0) return null;

  const settings: BarcodeLabelSettings = {
    ...DEFAULT_BARCODE_LABEL_SETTINGS,
    ...getBarcodeLabelSettings(),
    ...settingsOverride,
  };

  // Flatten items by requested qtyPrint
  const flatLabels: LabelPrintItem[] = [];
  items.forEach(item => {
    const count = Math.max(1, item.qtyPrint || 1);
    for (let i = 0; i < count; i++) {
      flatLabels.push(item);
    }
  });

  const widthMm = settings.widthMm || 40;
  const heightMm = settings.heightMm || 30;
  const columns = settings.columns === 2 ? 2 : 1;
  const columnGapMm = settings.columnGapMm || 2;
  const totalRowWidthMm = columns === 2 ? (widthMm * 2 + columnGapMm) : widthMm;

  // Compute adaptive font sizes and barcode height based on label dimensions
  const isMini = heightMm <= 18 || widthMm <= 33;
  const shopFontSize = isMini ? 6.5 : heightMm <= 30 ? 9 : 10.5;
  const itemFontSize = isMini ? 6 : heightMm <= 30 ? 8 : 9.5;
  const barcodeHeight = isMini ? 16 : heightMm <= 30 ? 28 : 36;
  const barcodeWidth = isMini ? 0.95 : widthMm <= 33 ? 1.1 : widthMm <= 40 ? 1.35 : 1.55;
  const priceFontSize = isMini ? 7.5 : heightMm <= 30 ? 11 : 13;
  const codeFontSize = isMini ? 6 : 8.5;

  const isContinuous = settings.paperMode === 'continuous_receipt';
  const isLandscape = settings.orientation === 'landscape';

  // Group into pairs if 2 columns (2 Line)
  const rows: (LabelPrintItem | null)[][] = [];
  if (columns === 2) {
    for (let i = 0; i < flatLabels.length; i += 2) {
      const left = flatLabels[i];
      const right = i + 1 < flatLabels.length ? flatLabels[i + 1] : null;
      rows.push([left, right]);
    }
  } else {
    for (let i = 0; i < flatLabels.length; i++) {
      rows.push([flatLabels[i]]);
    }
  }

  const renderLabelContent = (item: LabelPrintItem | null, isSlotEmpty = false) => {
    if (!item || isSlotEmpty) {
      return (
        <div
          className="thermal-single-label placeholder-slot"
          style={{
            visibility: 'hidden',
            width: `${widthMm}mm`,
            height: `${heightMm}mm`,
            boxSizing: 'border-box',
          }}
        />
      );
    }

    const variantText = [item.ukuran, item.warna].filter(Boolean).join(' / ');

    return (
      <div
        className="thermal-single-label"
        style={{
          width: `${widthMm}mm`,
          maxWidth: `${widthMm}mm`,
          height: `${heightMm}mm`,
          maxHeight: `${heightMm}mm`,
          boxSizing: 'border-box',
          padding: isMini ? '0.8mm 1.2mm' : '1.5mm 2mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: '#ffffff',
          color: '#000000',
          overflow: 'hidden',
        }}
      >
        {/* Nama Toko */}
        {settings.showShopName && settings.shopName && (
          <div
            style={{
              fontSize: `${shopFontSize}pt`,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              lineHeight: 1.1,
              marginBottom: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            {settings.shopName}
          </div>
        )}

        {/* Nama Barang */}
        {settings.showItemName && (
          <div
            style={{
              fontSize: `${itemFontSize}pt`,
              fontWeight: 600,
              lineHeight: 1.15,
              maxHeight: isMini ? '1.3em' : '2.4em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: isMini ? 'nowrap' : 'normal',
              width: '100%',
              marginBottom: 1,
            }}
          >
            {item.nama} {variantText ? `(${variantText})` : ''}
          </div>
        )}

        {/* Visual Barcode 1D */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '0.5px 0' }}>
          <BarcodeGenerator
            value={item.barcode}
            format={settings.barcodeFormat}
            width={barcodeWidth}
            height={barcodeHeight}
            displayValue={false}
          />
        </div>

        {/* Kode Barcode Human-Readable */}
        {settings.showBarcodeText && (
          <div
            style={{
              fontFamily: 'monospace, monospace',
              fontSize: `${codeFontSize}pt`,
              fontWeight: 700,
              letterSpacing: '0.06em',
              lineHeight: 1,
              marginBottom: 0.5,
            }}
          >
            {item.barcode}
          </div>
        )}

        {/* Harga Jual */}
        {settings.showPrice && item.harga_jual > 0 && (
          <div
            style={{
              fontSize: `${priceFontSize}pt`,
              fontWeight: 800,
              lineHeight: 1.1,
              marginTop: 0.5,
            }}
          >
            {formatRupiah(item.harga_jual)}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <div id="print-barcode-portal">
      <style>{`
        @media screen {
          #print-barcode-portal {
            display: none !important;
          }
        }
        @media print {
          @page {
            ${isLandscape ? 'size: landscape;' : 'size: portrait;'}
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
          }
          /* Hide regular application layout during label printing */
          .app-shell, .app-sidebar, .app-header, .app-main, .page-header, .pos-layout, .card, .modal-backdrop, .mobile-bottom-nav {
            display: none !important;
          }
          #print-barcode-portal {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            width: 100% !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .thermal-label-row {
            width: ${totalRowWidthMm}mm !important;
            max-width: ${totalRowWidthMm}mm !important;
            ${isContinuous
              ? `min-height: ${heightMm}mm !important;
                 height: auto !important;
                 page-break-after: avoid !important;
                 break-after: avoid !important;
                 page-break-inside: avoid !important;
                 break-inside: avoid !important;
                 border-bottom: 1px dashed #666666 !important;
                 margin-bottom: ${settings.gapMm || 2}mm !important;`
              : `height: ${heightMm}mm !important;
                 max-height: ${heightMm}mm !important;
                 page-break-after: always !important;
                 break-after: page !important;
                 page-break-inside: avoid !important;
                 break-inside: avoid !important;
                 margin: 0 auto !important;`
            }
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: ${columns === 2 ? 'space-between' : 'center'} !important;
            gap: ${columnGapMm}mm !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
          }
          .thermal-label-row:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            border-bottom: none !important;
            margin-bottom: 0 !important;
          }
        }
      `}</style>

      {rows.map((rowItems, rowIndex) => (
        <div key={rowIndex} className="thermal-label-row">
          {rowItems.map((item, colIndex) => (
            <div key={colIndex}>
              {renderLabelContent(item, item === null)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
