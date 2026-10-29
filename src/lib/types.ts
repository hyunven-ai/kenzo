// ============================================
// MASTER TYPES
// ============================================

export type Role = 'super_admin' | 'admin_gudang' | 'kasir';

export interface MsUser {
  id: number;
  username: string;
  nama_lengkap: string;
  role: Role;
  email?: string;
  is_active: boolean;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export type JenisToko = 'kelontong' | 'baju' | 'umum';

export interface MsKategori {
  id: number;
  kode: string;
  nama: string;
  jenis_toko: JenisToko;
  satuan_default: string;
  keterangan?: string;
  is_active?: boolean;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsMerk {
  id: number;
  nama: string;
  kategori: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsOperator {
  id: number;
  nama: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsSupplier {
  id: number;
  nama: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// ============================================
// STOCK TYPES
// ============================================

export interface MsBarang {
  id: number;
  barcode: string;
  nama: string;
  kategori: string;
  merk?: string;
  supplier?: string;
  satuan?: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  warna?: string;
  ukuran?: string;
  keterangan?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsAksesoris {
  id: number;
  supplier: string;
  barcode: string;
  merk: string;
  nama: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsSparepart {
  id: number;
  supplier: string;
  barcode: string;
  merk: string;
  nama: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface MsKuota {
  id: number;
  supplier: string;
  barcode: string;
  operator: string;
  description: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// HP Header
export interface MsHpHdr {
  id: number;
  supplier: string;
  merk: string;
  nama: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
  // computed
  stock_count?: number;
  details?: MsHpDtl[];
}

// HP Detail (per IMEI)
export interface MsHpDtl {
  id: number;
  idhdr: number;
  imei: string;
  harga_jual: number;
  harga_modal: number;
  status?: 'tersedia' | 'terjual';
  warna?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// HP Non Pajak Header
export interface MsHpHdrNonPajak {
  id: number;
  supplier: string;
  merk: string;
  nama: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
  stock_count?: number;
  details?: MsHpDtlNonPajak[];
}

// HP Non Pajak Detail
export interface MsHpDtlNonPajak {
  id: number;
  idhdr: number;
  imei: string;
  harga_jual: number;
  harga_modal: number;
  status?: 'tersedia' | 'terjual';
  warna?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// CCTV Header
export interface MsCctvHdr {
  id: number;
  supplier: string;
  merk: string;
  nama: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
  stock_count?: number;
  details?: MsCctvDtl[];
}

// CCTV Detail (per SN)
export interface MsCctvDtl {
  id: number;
  idhdr: number;
  sn_cctv: string;
  harga_jual: number;
  harga_modal: number;
  status?: 'tersedia' | 'terjual';
  warna?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// ============================================
// TRANSACTION TYPES
// ============================================

export type Kategori = 'HP' | 'HP Non Pajak' | 'Aksesoris' | 'CCTV' | 'Kuota' | 'Sparepart' | 'E-Wallet' | 'Jasa Service' | (string & {});
export type MetodePembayaran = 'Tunai' | 'Debit' | 'Transfer' | 'QRIS';

export interface TrsPembelianHdr {
  id: number;
  no_invoice?: string;
  supplier: string;
  tanggal_pembelian: string;
  status: 0 | 1; // 0=draft, 1=selesai
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
  details?: TrsPembelianDtl[];
}

export interface TrsPembelianDtl {
  id: number;
  idhdr: number;
  idbarang: number;
  kategori: Kategori;
  code: string;
  nama_barang: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

export interface TrsPenjualanHdr {
  id: number;
  nomor_invoice: string;
  customer: string;
  status: 0 | 1;
  tanggal_penjualan: string;
  metode_pembayaran?: MetodePembayaran;
  total_harga?: number;
  catatan?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
  details?: TrsPenjualanDtl[];
}

export interface TrsPenjualanDtl {
  id: number;
  idhdr: number;
  idbarang: number;
  kategori: Kategori;
  code: string;
  nama_barang: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  supplier?: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

// Cart item for POS
export interface CartItem {
  idbarang: number;
  kategori: Kategori;
  code: string;
  nama_barang: string;
  qty: number;
  harga_modal: number;
  harga_jual: number;
  supplier?: string;
  max_qty?: number;
}

// ============================================
// AUTH TYPES
// ============================================

export interface AuthUser {
  id: number;
  username: string;
  nama_lengkap: string;
  role: Role;
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  total_pemasukan: number;
  total_pengeluaran: number;
  total_keuntungan: number;
  total_produk: number;
  total_aset: number;
}

export interface ChartDataPoint {
  tanggal: string;
  pemasukan: number;
  pengeluaran: number;
  keuntungan: number;
}

export interface KategoriSales {
  kategori: string;
  jumlah: number;
  total: number;
}

// ============================================
// LOG TYPES
// ============================================

export interface LogAktivitas {
  id: number;
  user: string;
  aksi: string;
  tabel: string;
  detail: string;
  waktu: string;
}

// ============================================
// WARRANTY TYPES
// ============================================

export interface MsGaransi {
  id: number;
  id_transaksi: string;
  nama_pelanggan: string;
  nomor_whatsapp: string;
  imei1?: string;
  imei2?: string;
  nomor_seri?: string;
  merk_tipe: string;
  warna_kapasitas?: string;
  tanggal_pembelian: string;
  durasi_garansi: string;
  jenis_garansi: string;
  status_garansi: string;
  create_time: string;
  create_by?: string;
  update_time?: string;
  update_by?: string;
}

