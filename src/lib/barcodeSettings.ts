'use client';

export interface BarcodeLabelPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  columns?: number;
  columnGapMm?: number;
  offsetYMm?: number;
  offsetXMm?: number;
  description: string;
}

export const BARCODE_LABEL_PRESETS: BarcodeLabelPreset[] = [
  { id: '40x30', name: '40 mm × 30 mm', widthMm: 40, heightMm: 30, columns: 1, description: 'Standar Toko Baju & Kelontong (Rekomendasi Kenzo)' },
  { id: '50x30', name: '50 mm × 30 mm', widthMm: 50, heightMm: 30, columns: 1, description: 'Sedang / Format Luas' },
  { id: '30x20', name: '30 mm × 20 mm', widthMm: 30, heightMm: 20, columns: 1, description: 'Kecil / Kompak' },
  { id: '33x15_2line', name: '33 mm × 15 mm (2 Line)', widthMm: 33, heightMm: 15, columns: 2, columnGapMm: 2, offsetYMm: 0, description: 'ALGOO / 2 Kolom Berdampingan (Total Lebar ~68mm)' },
  { id: '33x15', name: '33 mm × 15 mm (1 Line)', widthMm: 33, heightMm: 15, columns: 1, offsetYMm: 0, description: 'Mini 1 Kolom / Aksesoris' },
  { id: '58x40', name: '58 mm × 40 mm', widthMm: 58, heightMm: 40, columns: 1, description: 'Besar / Label Ekstra Informasi' },
  { id: 'custom', name: 'Kustom (Bebas mm)', widthMm: 40, heightMm: 30, columns: 1, description: 'Tentukan lebar & tinggi sendiri' },
];

export type BarcodePrintPaperMode = 'roll_sticker' | 'continuous_receipt';
export type BarcodeOrientation = 'portrait' | 'landscape';

export interface BarcodeLabelSettings {
  presetId: string;
  widthMm: number;
  heightMm: number;
  shopName: string;
  showShopName: boolean;
  showPrice: boolean;
  showItemName: boolean;
  showBarcodeText: boolean;
  barcodeFormat: 'CODE128' | 'EAN13' | 'CODE39';
  gapMm: number;
  paperMode: BarcodePrintPaperMode;
  orientation: BarcodeOrientation;
  columns: number; // 1 = 1 Line, 2 = 2 Line (2 kolom stiker berdampingan)
  columnGapMm: number; // Jarak antar kolom stiker (default 2mm)
  offsetYMm: number; // Kalibrasi geser vertikal atas/bawah (mm, misal +1mm atau -1mm)
  offsetXMm: number; // Kalibrasi geser horizontal kiri/kanan (mm)
}

export const DEFAULT_BARCODE_LABEL_SETTINGS: BarcodeLabelSettings = {
  presetId: '40x30',
  widthMm: 40,
  heightMm: 30,
  shopName: 'Kenzo Store',
  showShopName: true,
  showPrice: true,
  showItemName: true,
  showBarcodeText: true,
  barcodeFormat: 'CODE128',
  gapMm: 2,
  paperMode: 'roll_sticker',
  orientation: 'portrait',
  columns: 1,
  columnGapMm: 2,
  offsetYMm: 0,
  offsetXMm: 0,
};

const STORAGE_KEY = 'series_barcode_label_settings';

export function getBarcodeLabelSettings(): BarcodeLabelSettings {
  if (typeof window === 'undefined') return DEFAULT_BARCODE_LABEL_SETTINGS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return DEFAULT_BARCODE_LABEL_SETTINGS;
  try {
    return { ...DEFAULT_BARCODE_LABEL_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_BARCODE_LABEL_SETTINGS;
  }
}

export function saveBarcodeLabelSettings(settings: Partial<BarcodeLabelSettings>): BarcodeLabelSettings {
  if (typeof window === 'undefined') return DEFAULT_BARCODE_LABEL_SETTINGS;
  const current = getBarcodeLabelSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  setTimeout(() => {
    window.dispatchEvent(new Event('barcode-settings-updated'));
  }, 0);
  return updated;
}

