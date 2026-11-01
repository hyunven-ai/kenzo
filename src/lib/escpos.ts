/**
 * ESC/POS Command Generator for 58mm and 80mm Thermal Printers
 * Pure TypeScript implementation with zero external dependencies.
 */

import { PrinterSettings } from './printerSettings';

export interface EscPosReceiptItem {
  nama_barang: string;
  qty: number;
  harga_jual: number;
  kategori?: string;
  code?: string;
}

export interface EscPosReceiptData {
  invoiceNo: string;
  customer?: string;
  tanggalPenjualan: string | Date;
  metodePembayaran?: string;
  items: EscPosReceiptItem[];
  total: number;
  bayar?: number;
  invoiceIndex?: number;
}

export class EscPosBuilder {
  private buffer: number[] = [];
  private lineWidth: number;

  constructor(paperWidth: '58mm' | '80mm' = '58mm') {
    this.lineWidth = paperWidth === '80mm' ? 48 : 32;
    this.init();
  }

  /**
   * Reset printer to default settings
   */
  init(): this {
    this.buffer.push(0x1b, 0x40); // ESC @
    return this;
  }

  /**
   * Set text alignment
   */
  align(alignment: 'left' | 'center' | 'right'): this {
    const val = alignment === 'center' ? 1 : alignment === 'right' ? 2 : 0;
    this.buffer.push(0x1b, 0x61, val); // ESC a n
    return this;
  }

  /**
   * Set bold mode
   */
  bold(enable: boolean): this {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0); // ESC E n
    return this;
  }

  /**
   * Set text size multiplier (1 = normal, 2 = double)
   */
  size(widthMultiplier: number = 1, heightMultiplier: number = 1): this {
    const w = Math.min(Math.max(widthMultiplier - 1, 0), 7);
    const h = Math.min(Math.max(heightMultiplier - 1, 0), 7);
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n); // GS ! n
    return this;
  }

  /**
   * Print standard text line (with newline)
   */
  textLine(str: string = ''): this {
    this.text(str);
    this.newLine();
    return this;
  }

  /**
   * Print text without newline
   */
  text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // Basic ASCII & CP437 mapping
      if (code < 128) {
        this.buffer.push(code);
      } else {
        // Fallback for special characters
        this.buffer.push(0x3f); // '?'
      }
    }
    return this;
  }

  /**
   * Feed single or multiple new lines
   */
  newLine(count: number = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0a); // LF
    }
    return this;
  }

  /**
   * Print horizontal divider line (e.g. ----------------)
   */
  divider(char: string = '-'): this {
    const line = char.repeat(this.lineWidth);
    this.textLine(line);
    return this;
  }

  /**
   * Print two columns aligned (Left column, Right column)
   */
  twoColumns(left: string, right: string): this {
    const maxLeft = this.lineWidth - right.length - 1;
    let cleanLeft = left;
    if (cleanLeft.length > maxLeft) {
      cleanLeft = cleanLeft.substring(0, maxLeft);
    }
    const spaces = Math.max(1, this.lineWidth - cleanLeft.length - right.length);
    this.textLine(cleanLeft + ' '.repeat(spaces) + right);
    return this;
  }

  /**
   * Feed paper lines just enough for manual tear or auto-cut.
   * On manual-tear thermal printers (like POS-58), feeding 1-2 lines is ideal to reach the tear bar without wasting blank paper.
   */
  cut(feedLines: number = 2, autoCut: boolean = false): this {
    this.newLine(feedLines);
    if (autoCut) {
      this.buffer.push(0x1d, 0x56, 0x00); // GS V 0 (instant cut without extra 30mm feed)
    }
    return this;
  }

  /**
   * Convert buffer to Uint8Array for Bluetooth/USB transmission
   */
  build(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Format a complete POS thermal receipt into ESC/POS binary data
 */
export function buildReceiptEscPos(
  data: EscPosReceiptData,
  settings: PrinterSettings
): Uint8Array {
  const paper = settings.paperWidth || '58mm';
  const builder = new EscPosBuilder(paper);

  // 1. Header (Nama Toko & Alamat)
  builder.align('center');
  builder.bold(true);
  builder.size(2, 2);
  builder.textLine(settings.shopName || 'Kenzo');
  builder.size(1, 1);
  builder.bold(false);

  if (settings.addressLine1) {
    builder.textLine(settings.addressLine1);
  }
  if (settings.addressLine2) {
    builder.textLine(settings.addressLine2);
  }
  if (settings.whatsappNumber) {
    builder.bold(true);
    builder.textLine(`WA: ${settings.whatsappNumber}`);
    builder.bold(false);
  }

  if (settings.showSocialMedia) {
    if (settings.facebookName) {
      builder.textLine(`FB: ${settings.facebookName.replace(/\n/g, ' / ')}`);
    }
    if (settings.instagramName) {
      builder.textLine(`IG: ${settings.instagramName}`);
    }
    if (settings.tiktokName) {
      builder.textLine(`TikTok: ${settings.tiktokName}`);
    }
  }

  builder.divider('-');

  // 2. Informasi Transaksi
  builder.align('left');
  const d = new Date(data.tanggalPenjualan);
  const formattedDate = !isNaN(d.getTime())
    ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : String(data.tanggalPenjualan);

  const displayIndex = data.invoiceIndex !== undefined
    ? `#${data.invoiceIndex}`
    : data.invoiceNo ? `#${data.invoiceNo.split('/').pop()?.replace(/^0+/, '') || data.invoiceNo}` : '';

  builder.twoColumns(formattedDate, displayIndex);
  builder.textLine(`Pembeli: ${data.customer || 'Umum'}`);
  builder.textLine(`No. Inv: ${data.invoiceNo}`);

  builder.divider('-');

  // 3. Daftar Barang
  let totalQty = 0;
  data.items.forEach((item, index) => {
    totalQty += item.qty;
    const cleanName = item.nama_barang.replace(/\s*\(Non Pajak\)/gi, '');
    builder.textLine(`${index + 1}. ${cleanName}`);

    // Tampilkan IMEI jika ada dan pengaturan showImei aktif
    if (settings.showImei && (item.kategori === 'HP' || item.kategori === 'HP Non Pajak') && item.code) {
      builder.textLine(`   IMEI: ${item.code}`);
    }

    const qtyPrice = `   ${item.qty}x ${item.harga_jual.toLocaleString('id-ID')}`;
    const subtotal = (item.qty * item.harga_jual).toLocaleString('id-ID');
    builder.twoColumns(qtyPrice, subtotal);
  });

  builder.divider('-');

  // 4. Ringkasan Total & Pembayaran
  builder.twoColumns(`Produk: ${data.items.length}`, `Total Qty: ${totalQty}`);
  
  builder.bold(true);
  builder.size(1, 2);
  builder.twoColumns('TOTAL:', `Rp ${data.total.toLocaleString('id-ID')}`);
  builder.size(1, 1);
  builder.bold(false);

  const cleanBayar = data.bayar !== undefined ? data.bayar : data.total;
  builder.twoColumns('Bayar:', `Rp ${cleanBayar.toLocaleString('id-ID')}`);

  const kembalian = cleanBayar - data.total;
  if (kembalian > 0) {
    builder.twoColumns('Kembali:', `Rp ${kembalian.toLocaleString('id-ID')}`);
  }

  builder.twoColumns('Metode:', data.metodePembayaran || 'Tunai');

  builder.divider('-');

  // 5. Footer & Catatan
  builder.align('center');
  if (settings.warningNote) {
    builder.textLine(settings.warningNote);
  }
  if (settings.footerNote) {
    builder.bold(true);
    builder.textLine(settings.footerNote);
    builder.bold(false);
  }

  // 6. Feed Kertas Hemat & Presisi (cukup 1-2 baris agar pas di gigi pemotong POS-58 tanpa membuang kertas)
  const feedCount = typeof settings.feedLines === 'number' ? settings.feedLines : 2;
  builder.cut(feedCount, false);

  return builder.build();
}

/**
 * Format Test Print receipt for POS-58
 */
export function buildTestPrintEscPos(settings: PrinterSettings): Uint8Array {
  const paper = settings.paperWidth || '58mm';
  const builder = new EscPosBuilder(paper);

  builder.align('center');
  builder.bold(true);
  builder.size(2, 2);
  builder.textLine(settings.shopName || 'Kenzo');
  builder.size(1, 1);
  builder.textLine('=== TES PRINTER POS-58 ===');
  builder.bold(false);
  builder.newLine();

  builder.textLine(`Status: Koneksi Bluetooth Native OK!`);
  builder.textLine(`Waktu: ${new Date().toLocaleTimeString('id-ID')}`);
  builder.textLine(`Ukuran Kertas: ${paper}`);
  builder.divider('=');

  builder.align('left');
  builder.textLine('1. Test Huruf Normal: ABCDEFG 12345');
  builder.bold(true);
  builder.textLine('2. Test Huruf Tebal (Bold): OK');
  builder.bold(false);
  builder.twoColumns('3. Test Rata Kiri-Kanan', '100% PASS');

  builder.divider('=');
  builder.align('center');
  builder.bold(true);
  builder.textLine('PRINTER SIAP DIGUNAKAN');
  builder.bold(false);
  builder.textLine('Kasir Pintar POS System');

  builder.cut(2, false);
  return builder.build();
}

