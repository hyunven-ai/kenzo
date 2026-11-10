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

  const isContinuous = settings.paperMode === 'continuous_receipt';

  // Compute adaptive font sizes and barcode height based on label dimensions
  const isMini = heightMm <= 18 || widthMm <= 33;
  const contentHeightMm = isContinuous ? heightMm : (heightMm <= 18 ? heightMm - 1.2 : heightMm - 0.4);
  const shopFontSize = isMini ? 5.6 : heightMm <= 30 ? 9 : 10.5;
  const itemFontSize = isMini ? 5.8 : heightMm <= 30 ? 8 : 9.5;
  const barcodeHeight = isMini ? 19 : heightMm <= 30 ? 28 : 36;
  const barcodeWidth = isMini ? 0.85 : widthMm <= 33 ? 1.1 : widthMm <= 40 ? 1.35 : 1.55;
  const priceFontSize = isMini ? 7.8 : heightMm <= 30 ? 11 : 13;
  const codeFontSize = isMini ? 7.0 : 8.5;

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

  const renderLabelContent = (item: LabelPrintItem | null, isSlotEmpty = false, key?: number | string) => {
    if (!item || isSlotEmpty) {
      return (
        <div
          key={key}
          className="thermal-single-label placeholder-slot"
          style={{
            visibility: 'hidden',
            width: `${widthMm}mm`,
            height: `${contentHeightMm}mm`,
            boxSizing: 'border-box',
          }}
        />
      );
    }

    const variantText = [item.ukuran, item.warna].filter(Boolean).join(' / ');
    const offsetX = settings.offsetXMm || 0;
    const offsetY = settings.offsetYMm || 0;

    return (
      <div
        key={key}
        className="thermal-single-label"
        style={{
          width: `${widthMm}mm`,
          maxWidth: `${widthMm}mm`,
          height: `${contentHeightMm}mm`,
          maxHeight: `${contentHeightMm}mm`,
          boxSizing: 'border-box',
          paddingTop: isMini ? `${Math.max(0.5, 1.45 + offsetY)}mm` : '1.8mm',
          paddingBottom: isMini ? '0.2mm' : '1.5mm',
          paddingLeft: isMini ? `${Math.max(1.0, 1.8 + offsetX)}mm` : '2mm',
          paddingRight: isMini ? `${Math.max(1.0, 1.8 - offsetX)}mm` : '2mm',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: isMini ? 'flex-start' : 'center',
          textAlign: 'center',
          background: '#ffffff',
          color: '#000000',
          overflow: 'hidden',
          position: 'relative',
          pageBreakInside: 'avoid',
          breakInside: 'avoid',
        }}
      >
        {/* Nama Toko */}
        {settings.showShopName && settings.shopName && (
          <div
            style={{
              fontSize: `${shopFontSize}pt`,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              lineHeight: 1,
              marginBottom: 0.5,
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
              lineHeight: 1.05,
              maxHeight: isMini ? '1.15em' : '2.4em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              marginBottom: 0.5,
            }}
          >
            {item.nama} {variantText ? `(${variantText})` : ''}
          </div>
        )}

        {/* Visual Barcode 1D */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '0.4px 0', padding: '0 1.2mm', boxSizing: 'border-box' }}>
          <BarcodeGenerator
            value={item.barcode}
            format={settings.barcodeFormat}
            width={barcodeWidth}
            height={barcodeHeight}
            displayValue={false}
          />
        </div>

        {/* Kode Barcode & Harga Jual */}
        {isMini ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: settings.showBarcodeText && (settings.showPrice && item.harga_jual > 0) ? 'space-between' : 'center',
              marginTop: 0.6,
              padding: '0 0.2mm',
              lineHeight: 1,
            }}
          >
            {settings.showBarcodeText && (
              <div
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  fontSize: `${codeFontSize}pt`,
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.barcode}
              </div>
            )}
            {settings.showPrice && item.harga_jual > 0 && (
              <div
                style={{
                  fontSize: `${priceFontSize}pt`,
                  fontWeight: 900,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {formatRupiah(item.harga_jual)}
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
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
            size: ${totalRowWidthMm}mm ${heightMm}mm ${settings.orientation === 'landscape' ? 'landscape' : 'portrait'};
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: ${totalRowWidthMm}mm !important;
            height: auto !important;
          }
          /* Hide regular application layout during label printing */
          .app-shell, .app-sidebar, .app-header, .app-main, .page-header, .pos-layout, .card, .modal-backdrop, .mobile-bottom-nav {
            display: none !important;
          }
          #print-barcode-portal {
            display: block !important;
            width: ${totalRowWidthMm}mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
          }
          .thermal-label-row {
            display: block !important;
            width: ${totalRowWidthMm}mm !important;
            max-width: ${totalRowWidthMm}mm !important;
            ${isContinuous
              ? `min-height: ${contentHeightMm}mm !important;
                 height: auto !important;
                 page-break-after: avoid !important;
                 break-after: avoid !important;
                 page-break-inside: avoid !important;
                 break-inside: avoid !important;
                 margin-bottom: ${settings.gapMm || 2}mm !important;`
              : `height: ${contentHeightMm}mm !important;
                 max-height: ${contentHeightMm}mm !important;
                 page-break-after: always !important;
                 break-after: page !important;
                 page-break-inside: avoid !important;
                 break-inside: avoid !important;
                 margin: 0 auto !important;`
            }
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: hidden !important;
            clear: both !important;
          }
          .thermal-label-row:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
            margin-bottom: 0 !important;
          }
          .thermal-row-inner {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: ${columns === 2 ? 'space-between' : 'center'} !important;
            width: 100% !important;
            height: 100% !important;
            gap: ${columnGapMm}mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {rows.map((rowItems, rowIndex) => (
        <div key={rowIndex} className="thermal-label-row">
          <div className="thermal-row-inner">
            {rowItems.map((item, colIndex) => renderLabelContent(item, item === null, colIndex))}
          </div>
        </div>
      ))}
    </div>
  );

  return createPortal(content, document.body);
}
