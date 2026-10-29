import { formatRupiah } from './utils';
import { getCurrentUser } from './auth';

// ============================================
// SUPABASE DATA HELPERS
// (Semua fungsi ini berinteraksi dgn Supabase)
// ============================================

import { supabase } from './supabase';
import type {
  MsAksesoris, MsKuota, MsSparepart, MsHpHdr, MsHpDtl,
  MsHpHdrNonPajak, MsHpDtlNonPajak, MsCctvHdr, MsCctvDtl,
  MsMerk, MsOperator, MsSupplier,
  TrsPembelianHdr, TrsPembelianDtl,
  TrsPenjualanHdr, TrsPenjualanDtl,
  DashboardStats, ChartDataPoint, KategoriSales,
  MsGaransi,
  MsKategori,
} from './types';

// ============================================
// MASTER KATEGORI STOCK (KELONTONG & BAJU)
// ============================================

export const DEFAULT_KATEGORI_PRESETS: Omit<MsKategori, 'id' | 'create_time'>[] = [
  // Toko Kelontong
  { kode: 'SMBK', nama: 'Sembako', jenis_toko: 'kelontong', satuan_default: 'Kg', keterangan: 'Beras, Minyak, Gula, Tepung, Telur' },
  { kode: 'SNK', nama: 'Makanan & Snack', jenis_toko: 'kelontong', satuan_default: 'Pcs', keterangan: 'Biskuit, Keripik, Mie Instan, Roti' },
  { kode: 'MNM', nama: 'Minuman', jenis_toko: 'kelontong', satuan_default: 'Pcs', keterangan: 'Air Mineral, Kopi, Teh, Minuman Dingin' },
  { kode: 'BMBU', nama: 'Bumbu & Bahan Masak', jenis_toko: 'kelontong', satuan_default: 'Pcs', keterangan: 'Kecap, Saus, Garam, Bumbu Sachet' },
  { kode: 'KBRS', nama: 'Kebersihan & Mandi', jenis_toko: 'kelontong', satuan_default: 'Pcs', keterangan: 'Sabun, Sampo, Deterjen, Pasta Gigi' },
  { kode: 'ROK', nama: 'Rokok & Tembakau', jenis_toko: 'kelontong', satuan_default: 'Bungkus', keterangan: 'Aneka rokok filter & kretek' },
  { kode: 'GAS', nama: 'Gas & Galon', jenis_toko: 'kelontong', satuan_default: 'Tabung', keterangan: 'Gas LPG 3kg, Galon Aqua/Isi Ulang' },
  // Toko Baju
  { kode: 'KAOS', nama: 'Kaos & T-Shirt', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Kaos oblong, polo shirt, raglan' },
  { kode: 'KMJ', nama: 'Kemeja Pria & Wanita', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Kemeja formal, kasual, batik' },
  { kode: 'CLN', nama: 'Celana & Rok', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Jeans, chinos, celana kain, rok panjang' },
  { kode: 'GMS', nama: 'Gamis & Busana Muslim', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Gamis, koko, tunik, hijab' },
  { kode: 'ANK', nama: 'Pakaian Anak & Bayi', jenis_toko: 'baju', satuan_default: 'Set', keterangan: 'Baju setelan anak, romper, celana anak' },
  { kode: 'JKT', nama: 'Jaket & Outerwear', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Jaket, hoodie, sweater, cardigan' },
  { kode: 'AKSF', nama: 'Aksesoris Fashion', jenis_toko: 'baju', satuan_default: 'Pcs', keterangan: 'Topi, sabuk, kaos kaki, syal' },
];

function getLocalKategoris(): MsKategori[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('local_ms_kategori');
  if (!raw) {
    const initial: MsKategori[] = DEFAULT_KATEGORI_PRESETS.map((p, idx) => ({
      ...p,
      id: idx + 1,
      is_active: true,
      create_time: new Date().toISOString(),
    }));
    localStorage.setItem('local_ms_kategori', JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalKategoris(data: MsKategori[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('local_ms_kategori', JSON.stringify(data));
  }
}

export async function getKategoris(): Promise<MsKategori[]> {
  try {
    const { data, error } = await supabase
      .from('ms_kategori')
      .select('*')
      .order('nama');
    if (error || !data || data.length === 0) {
      return getLocalKategoris();
    }
    return data as MsKategori[];
  } catch {
    return getLocalKategoris();
  }
}

export async function createKategori(payload: Omit<MsKategori, 'id' | 'create_time'>): Promise<MsKategori> {
  const localList = getLocalKategoris();
  const nextId = localList.length > 0 ? Math.max(...localList.map(k => k.id)) + 1 : 1;
  const newRecord: MsKategori = {
    ...payload,
    id: nextId,
    is_active: payload.is_active ?? true,
    create_time: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('ms_kategori')
      .insert(payload)
      .select()
      .single();
    if (!error && data) {
      saveLocalKategoris([...localList, data as MsKategori]);
      return data as MsKategori;
    }
  } catch {
    // fallback to local
  }

  const updated = [...localList, newRecord];
  saveLocalKategoris(updated);
  return newRecord;
}

export async function updateKategori(id: number, payload: Partial<MsKategori>): Promise<MsKategori> {
  const localList = getLocalKategoris();
  const index = localList.findIndex(k => k.id === id);
  const updatedItem: MsKategori = {
    ...(index >= 0 ? localList[index] : ({} as MsKategori)),
    ...payload,
    id,
    update_time: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from('ms_kategori')
      .update({ ...payload, update_time: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (!error && data) {
      if (index >= 0) localList[index] = data as MsKategori;
      saveLocalKategoris(localList);
      return data as MsKategori;
    }
  } catch {
    // fallback
  }

  if (index >= 0) {
    localList[index] = updatedItem;
    saveLocalKategoris(localList);
  }
  return updatedItem;
}

export async function deleteKategori(id: number): Promise<void> {
  try {
    await supabase.from('ms_kategori').delete().eq('id', id);
  } catch {
    // fallback
  }
  const localList = getLocalKategoris().filter(k => k.id !== id);
  saveLocalKategoris(localList);
}

export async function seedContohKategori(preset: 'semua' | 'kelontong' | 'baju' = 'semua'): Promise<MsKategori[]> {
  const filtered = DEFAULT_KATEGORI_PRESETS.filter(p => preset === 'semua' || p.jenis_toko === preset);
  const current = getLocalKategoris();
  const existingNames = new Set(current.map(c => c.nama.toLowerCase()));
  
  const toAdd = filtered.filter(p => !existingNames.has(p.nama.toLowerCase()));
  if (toAdd.length === 0) return current;

  let maxId = current.length > 0 ? Math.max(...current.map(c => c.id)) : 0;
  const newItems: MsKategori[] = toAdd.map(item => {
    maxId++;
    return {
      ...item,
      id: maxId,
      is_active: true,
      create_time: new Date().toISOString(),
    };
  });

  const merged = [...current, ...newItems];
  saveLocalKategoris(merged);

  try {
    await supabase.from('ms_kategori').insert(toAdd);
  } catch {
    // ignore
  }

  return merged;
}

// ============================================
// MASTER DATA
// ============================================

export async function getMerks() {
  const { data, error } = await supabase
    .from('ms_merk')
    .select('*')
    .order('nama');
  if (error) throw error;
  return data as MsMerk[];
}

export async function createMerk(payload: Omit<MsMerk, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_merk')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as MsMerk;
}

export async function updateMerk(id: number, payload: Partial<MsMerk>) {
  const { data, error } = await supabase
    .from('ms_merk')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsMerk;
}

export async function deleteMerk(id: number) {
  const { error } = await supabase.from('ms_merk').delete().eq('id', id);
  if (error) throw error;
}

export async function getOperators() {
  const { data, error } = await supabase
    .from('ms_operator')
    .select('*')
    .order('nama');
  if (error) throw error;
  return data as MsOperator[];
}

export async function createOperator(payload: Omit<MsOperator, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_operator')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as MsOperator;
}

export async function updateOperator(id: number, payload: Partial<MsOperator>) {
  const { data, error } = await supabase
    .from('ms_operator')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsOperator;
}

export async function deleteOperator(id: number) {
  const { error } = await supabase.from('ms_operator').delete().eq('id', id);
  if (error) throw error;
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from('ms_supplier')
    .select('*')
    .order('nama');
  if (error) throw error;
  return data as MsSupplier[];
}

export async function createSupplier(payload: Omit<MsSupplier, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_supplier')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as MsSupplier;
}

export async function updateSupplier(id: number, payload: Partial<MsSupplier>) {
  const { data, error } = await supabase
    .from('ms_supplier')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsSupplier;
}

export async function deleteSupplier(id: number) {
  const { error } = await supabase.from('ms_supplier').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// STOCK - AKSESORIS
// ============================================

export async function getAksesoris() {
  const { data, error } = await supabase
    .from('ms_aksesoris')
    .select('*')
    .order('nama');
  if (error) throw error;
  return data as MsAksesoris[];
}

export async function createAksesoris(payload: Omit<MsAksesoris, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_aksesoris')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_aksesoris', `Tambah Aksesoris: ${payload.nama} (Merk: ${payload.merk}, Qty: ${payload.qty})`);
  return data as MsAksesoris;
}

export async function updateAksesoris(id: number, payload: Partial<MsAksesoris>) {
  const { data, error } = await supabase
    .from('ms_aksesoris')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsAksesoris;
}

export async function deleteAksesoris(id: number) {
  const { error } = await supabase.from('ms_aksesoris').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// STOCK - SPAREPART
// ============================================

export async function getSparepart() {
  const { data, error } = await supabase
    .from('ms_sparepart')
    .select('*')
    .order('nama');
  if (error) throw error;
  return data as MsSparepart[];
}

export async function createSparepart(payload: Omit<MsSparepart, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_sparepart')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_sparepart', `Tambah Sparepart: ${payload.nama} (Merk: ${payload.merk}, Qty: ${payload.qty})`);
  return data as MsSparepart;
}

export async function updateSparepart(id: number, payload: Partial<MsSparepart>) {
  const { data, error } = await supabase
    .from('ms_sparepart')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsSparepart;
}

export async function deleteSparepart(id: number) {
  const { error } = await supabase.from('ms_sparepart').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// STOCK - KUOTA
// ============================================

export async function getKuota() {
  const { data, error } = await supabase
    .from('ms_kuota')
    .select('*')
    .order('description');
  if (error) throw error;
  return data as MsKuota[];
}

export async function createKuota(payload: Omit<MsKuota, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_kuota')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_kuota', `Tambah Kuota: ${payload.description} (Operator: ${payload.operator}, Qty: ${payload.qty})`);
  return data as MsKuota;
}

export async function updateKuota(id: number, payload: Partial<MsKuota>) {
  const { data, error } = await supabase
    .from('ms_kuota')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsKuota;
}

export async function deleteKuota(id: number) {
  const { error } = await supabase.from('ms_kuota').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// STOCK - HP (Header + Detail)
// ============================================

export async function getHpHdr() {
  const { data, error } = await supabase
    .from('ms_hp_hdr')
    .select(`*, ms_hp_dtl(*)`)
    .order('nama');
  if (error) throw error;
  return (data as MsHpHdr[]).map(h => {
    const dtls = (h as unknown as { ms_hp_dtl?: MsHpDtl[] }).ms_hp_dtl ?? [];
    return {
      ...h,
      details: h.details || [],
      stock_count: dtls.filter(d => !d.status || d.status === 'tersedia').length ?? 0,
      imei_list: dtls.filter(d => !d.status || d.status === 'tersedia').map(d => d.imei).join(' '),
    };
  });
}

export async function createHpHdr(payload: Omit<MsHpHdr, 'id' | 'create_time' | 'stock_count' | 'details'>) {
  const { data, error } = await supabase
    .from('ms_hp_hdr')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_hp_hdr', `Tambah Model HP: ${payload.nama} (Merk: ${payload.merk}, Supplier: ${payload.supplier})`);
  return data as MsHpHdr;
}

export async function updateHpHdr(id: number, payload: Partial<MsHpHdr>) {
  const { data, error } = await supabase
    .from('ms_hp_hdr')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsHpHdr;
}

export async function deleteHpHdr(id: number) {
  const { error } = await supabase.from('ms_hp_hdr').delete().eq('id', id);
  if (error) throw error;
}

export async function getHpDtl(idhdr: number) {
  const { data, error } = await supabase
    .from('ms_hp_dtl')
    .select('*')
    .eq('idhdr', idhdr)
    .order('create_time', { ascending: false });
  if (error) throw error;
  return (data as MsHpDtl[]).filter(d => !d.status || d.status !== 'terjual');
}

export async function createHpDtl(payload: Omit<MsHpDtl, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_hp_dtl')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_hp_dtl', `Tambah IMEI HP: ${payload.imei} (Warna: ${payload.warna || '-'}, Modal: ${formatRupiah(payload.harga_modal)})`);
  return data as MsHpDtl;
}

export async function deleteHpDtl(id: number) {
  const { error } = await supabase.from('ms_hp_dtl').delete().eq('id', id);
  if (error) throw error;
}

export async function updateHpDtl(id: number, payload: Partial<MsHpDtl>) {
  const { data, error } = await supabase
    .from('ms_hp_dtl')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await writeLog('UPDATE', 'ms_hp_dtl', `Ubah detail HP ID: ${id} - IMEI: ${payload.imei || '-'} (Warna: ${payload.warna || '-'}, Jual: ${payload.harga_jual ? formatRupiah(payload.harga_jual) : '-'})`);
  return data as MsHpDtl;
}

// ============================================
// STOCK - HP NON PAJAK
// ============================================

export async function getHpNonPajakHdr() {
  const { data, error } = await supabase
    .from('ms_hp_hdr_non_pajak')
    .select(`*, ms_hp_dtl_non_pajak(*)`)
    .order('nama');
  if (error) throw error;
  return (data as MsHpHdrNonPajak[]).map(h => {
    const dtls = (h as unknown as { ms_hp_dtl_non_pajak?: MsHpDtlNonPajak[] }).ms_hp_dtl_non_pajak ?? [];
    return {
      ...h,
      imei_list: dtls.filter(d => !d.status || d.status === 'tersedia').map(d => d.imei).join(' '),
    };
  });
}

export async function createHpNonPajakHdr(payload: Omit<MsHpHdrNonPajak, 'id' | 'create_time' | 'stock_count' | 'details'>) {
  const { data, error } = await supabase
    .from('ms_hp_hdr_non_pajak')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_hp_hdr_non_pajak', `Tambah Model HP Non Pajak: ${payload.nama} (Merk: ${payload.merk}, Supplier: ${payload.supplier})`);
  return data as MsHpHdrNonPajak;
}

export async function getHpNonPajakDtl(idhdr: number) {
  const { data, error } = await supabase
    .from('ms_hp_dtl_non_pajak')
    .select('*')
    .eq('idhdr', idhdr)
    .order('create_time', { ascending: false });
  if (error) throw error;
  return (data as MsHpDtlNonPajak[]).filter(d => !d.status || d.status !== 'terjual');
}

export async function createHpNonPajakDtl(payload: Omit<MsHpDtlNonPajak, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_hp_dtl_non_pajak')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_hp_dtl_non_pajak', `Tambah IMEI HP Non Pajak: ${payload.imei} (Warna: ${payload.warna || '-'}, Modal: ${formatRupiah(payload.harga_modal)})`);
  return data as MsHpDtlNonPajak;
}

export async function deleteHpNonPajakDtl(id: number) {
  const { error } = await supabase.from('ms_hp_dtl_non_pajak').delete().eq('id', id);
  if (error) throw error;
}

export async function updateHpNonPajakDtl(id: number, payload: Partial<MsHpDtlNonPajak>) {
  const { data, error } = await supabase
    .from('ms_hp_dtl_non_pajak')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await writeLog('UPDATE', 'ms_hp_dtl_non_pajak', `Ubah detail HP Non Pajak ID: ${id} - IMEI: ${payload.imei || '-'} (Warna: ${payload.warna || '-'}, Jual: ${payload.harga_jual ? formatRupiah(payload.harga_jual) : '-'})`);
  return data as MsHpDtlNonPajak;
}

export async function updateHpNonPajakHdr(id: number, payload: Partial<MsHpHdrNonPajak>) {
  const { data, error } = await supabase
    .from('ms_hp_hdr_non_pajak')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsHpHdrNonPajak;
}

// ============================================
// STOCK - CCTV
// ============================================

export async function getCctvHdr() {
  const { data, error } = await supabase
    .from('ms_cctv_hdr')
    .select(`*, ms_cctv_dtl(*)`)
    .order('nama');
  if (error) throw error;
  return data as MsCctvHdr[];
}

export async function createCctvHdr(payload: Omit<MsCctvHdr, 'id' | 'create_time' | 'stock_count' | 'details'>) {
  const { data, error } = await supabase
    .from('ms_cctv_hdr')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_cctv_hdr', `Tambah Model CCTV: ${payload.nama} (Merk: ${payload.merk}, Supplier: ${payload.supplier})`);
  return data as MsCctvHdr;
}

export async function getCctvDtl(idhdr: number) {
  const { data, error } = await supabase
    .from('ms_cctv_dtl')
    .select('*')
    .eq('idhdr', idhdr)
    .order('create_time', { ascending: false });
  if (error) throw error;
  return (data as MsCctvDtl[]).filter(d => !d.status || d.status !== 'terjual');
}

export async function createCctvDtl(payload: Omit<MsCctvDtl, 'id' | 'create_time'>) {
  const { data, error } = await supabase
    .from('ms_cctv_dtl')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  await writeLog('INSERT', 'ms_cctv_dtl', `Tambah SN CCTV: ${payload.sn_cctv} (Warna: ${payload.warna || '-'}, Modal: ${formatRupiah(payload.harga_modal)})`);
  return data as MsCctvDtl;
}

export async function deleteCctvDtl(id: number) {
  const { error } = await supabase.from('ms_cctv_dtl').delete().eq('id', id);
  if (error) throw error;
}

export async function updateCctvDtl(id: number, payload: Partial<MsCctvDtl>) {
  const { data, error } = await supabase
    .from('ms_cctv_dtl')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await writeLog('UPDATE', 'ms_cctv_dtl', `Ubah detail CCTV ID: ${id} - SN: ${payload.sn_cctv || '-'} (Warna: ${payload.warna || '-'}, Jual: ${payload.harga_jual ? formatRupiah(payload.harga_jual) : '-'})`);
  return data as MsCctvDtl;
}

export async function updateCctvHdr(id: number, payload: Partial<MsCctvHdr>) {
  const { data, error } = await supabase
    .from('ms_cctv_hdr')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as MsCctvHdr;
}

// ============================================
// TRANSAKSI PENJUALAN
// ============================================

export async function getPenjualan(from?: string, to?: string) {
  let allData: TrsPenjualanHdr[] = [];
  let fromIndex = 0;
  const step = 1000;

  while (true) {
    let query = supabase
      .from('trs_penjualan_hdr')
      .select(`*, trs_penjualan_dtl(*)`)
      .order('tanggal_penjualan', { ascending: false })
      .range(fromIndex, fromIndex + step - 1);

    if (from) {
      const d = new Date(from);
      d.setDate(d.getDate() - 1);
      const marginFrom = d.toISOString().split('T')[0];
      query = query.gte('tanggal_penjualan', marginFrom + 'T00:00:00Z');
    }
    if (to) {
      const d = new Date(to);
      d.setDate(d.getDate() + 1);
      const marginTo = d.toISOString().split('T')[0];
      query = query.lte('tanggal_penjualan', marginTo + 'T23:59:59Z');
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data) {
      allData = [...allData, ...(data as TrsPenjualanHdr[])];
    }

    if (!data || data.length < step) {
      break;
    }

    fromIndex += step;
  }

  return allData;
}

export async function createPenjualan(
  header: Omit<TrsPenjualanHdr, 'id' | 'create_time' | 'details'>,
  items: Omit<TrsPenjualanDtl, 'id' | 'idhdr' | 'create_time'>[]
) {
  const { data: hdr, error: hdrErr } = await supabase
    .from('trs_penjualan_hdr')
    .insert(header)
    .select()
    .single();
  if (hdrErr) throw hdrErr;

  const dtls = items.map(item => ({ ...item, idhdr: hdr.id }));
  const { error: dtlErr } = await supabase
    .from('trs_penjualan_dtl')
    .insert(dtls);
  if (dtlErr) throw dtlErr;

  // Kurangi stok
  for (const item of items) {
    await kurangiStok(item.idbarang, item.kategori as string, item.qty, item.code);
  }

  await writeLog('INSERT', 'trs_penjualan_hdr', `Penjualan ${header.nomor_invoice} — Total: ${formatRupiah(header.total_harga || 0)}`);

  return hdr as TrsPenjualanHdr;
}

async function kurangiStok(idbarang: number, kategori: string, qty: number, code: string) {
  if (kategori === 'Aksesoris') {
    await supabase.rpc('kurangi_qty_aksesoris', { p_id: idbarang, p_qty: qty });
  } else if (kategori === 'Kuota') {
    await supabase.rpc('kurangi_qty_kuota', { p_id: idbarang, p_qty: qty });
  } else if (kategori === 'HP') {
    // Mark IMEI sebagai terjual
    await supabase
      .from('ms_hp_dtl')
      .update({ status: 'terjual', update_time: new Date().toISOString() })
      .eq('id', idbarang);
  } else if (kategori === 'HP Non Pajak') {
    await supabase
      .from('ms_hp_dtl_non_pajak')
      .update({ status: 'terjual', update_time: new Date().toISOString() })
      .eq('id', idbarang);
  } else if (kategori === 'CCTV') {
    await supabase
      .from('ms_cctv_dtl')
      .update({ status: 'terjual', update_time: new Date().toISOString() })
      .eq('id', idbarang);
  } else if (kategori === 'Sparepart') {
    await supabase.rpc('kurangi_qty_sparepart', { p_id: idbarang, p_qty: qty });
  }
  // E-Wallet and Jasa Service have no inventory – nothing to reduce
}

export async function deletePenjualan(id: number) {
  // 1. Dapatkan detail penjualan untuk mengembalikan stok
  const { data: dtls, error: dtlErr } = await supabase
    .from('trs_penjualan_dtl')
    .select('*')
    .eq('idhdr', id);
  if (dtlErr) throw dtlErr;

  // 2. Kembalikan stok masing-masing barang
  if (dtls) {
    for (const item of dtls) {
      await tambahStok(item.idbarang, item.kategori, item.qty);
    }
  }

  // 3. Hapus header penjualan (relasi cascade akan otomatis menghapus detail)
  const { error: hdrErr } = await supabase
    .from('trs_penjualan_hdr')
    .delete()
    .eq('id', id);
  if (hdrErr) throw hdrErr;

  await writeLog('DELETE', 'trs_penjualan_hdr', `Hapus penjualan ID: ${id}`);
}

export async function cancelBarangTerjual(detailId: number) {
  // 1. Dapatkan detail barang terjual
  const { data: dtl, error: dtlErr } = await supabase
    .from('trs_penjualan_dtl')
    .select('*')
    .eq('id', detailId)
    .single();
  if (dtlErr) throw dtlErr;
  if (!dtl) throw new Error('Detail barang terjual tidak ditemukan');

  const { idhdr, idbarang, kategori, qty, harga_jual, code, nama_barang } = dtl;

  // 2. Kembalikan stok barang
  await tambahStok(idbarang, kategori, qty);

  // 3. Hapus row di trs_penjualan_dtl
  const { error: delErr } = await supabase
    .from('trs_penjualan_dtl')
    .delete()
    .eq('id', detailId);
  if (delErr) throw delErr;

  // 4. Update atau hapus header penjualan
  const { data: remaining, error: remErr } = await supabase
    .from('trs_penjualan_dtl')
    .select('id')
    .eq('idhdr', idhdr);
  if (remErr) throw remErr;

  if (!remaining || remaining.length === 0) {
    // Jika tidak ada item tersisa, hapus header
    const { error: hdrDelErr } = await supabase
      .from('trs_penjualan_hdr')
      .delete()
      .eq('id', idhdr);
    if (hdrDelErr) throw hdrDelErr;
  } else {
    // Jika masih ada item tersisa, kurangi total_harga header
    const { data: hdr, error: hdrGetErr } = await supabase
      .from('trs_penjualan_hdr')
      .select('total_harga')
      .eq('id', idhdr)
      .single();
    if (hdrGetErr) throw hdrGetErr;

    const newTotal = (hdr?.total_harga || 0) - (harga_jual * qty);
    const { error: hdrUpdErr } = await supabase
      .from('trs_penjualan_hdr')
      .update({ total_harga: newTotal, update_time: new Date().toISOString() })
      .eq('id', idhdr);
    if (hdrUpdErr) throw hdrUpdErr;
  }

  await writeLog('DELETE', 'trs_penjualan_dtl', `Batal terjual detail ID: ${detailId}, Barang: ${nama_barang}, Code: ${code || '-'}, Qty: ${qty}`);
}

export async function deleteBarangTerjual(detailId: number) {
  // 1. Dapatkan detail barang terjual
  const { data: dtl, error: dtlErr } = await supabase
    .from('trs_penjualan_dtl')
    .select('*')
    .eq('id', detailId)
    .single();
  if (dtlErr) throw dtlErr;
  if (!dtl) throw new Error('Detail barang terjual tidak ditemukan');

  const { idhdr, qty, harga_jual, code, nama_barang } = dtl;

  // 2. Hapus row di trs_penjualan_dtl (TIDAK mengembalikan stok)
  const { error: delErr } = await supabase
    .from('trs_penjualan_dtl')
    .delete()
    .eq('id', detailId);
  if (delErr) throw delErr;

  // 3. Update atau hapus header penjualan
  const { data: remaining, error: remErr } = await supabase
    .from('trs_penjualan_dtl')
    .select('id')
    .eq('idhdr', idhdr);
  if (remErr) throw remErr;

  if (!remaining || remaining.length === 0) {
    // Jika tidak ada item tersisa, hapus header
    const { error: hdrDelErr } = await supabase
      .from('trs_penjualan_hdr')
      .delete()
      .eq('id', idhdr);
    if (hdrDelErr) throw hdrDelErr;
  } else {
    // Jika masih ada item tersisa, kurangi total_harga header
    const { data: hdr, error: hdrGetErr } = await supabase
      .from('trs_penjualan_hdr')
      .select('total_harga')
      .eq('id', idhdr)
      .single();
    if (hdrGetErr) throw hdrGetErr;

    const newTotal = (hdr?.total_harga || 0) - (harga_jual * qty);
    const { error: hdrUpdErr } = await supabase
      .from('trs_penjualan_hdr')
      .update({ total_harga: newTotal, update_time: new Date().toISOString() })
      .eq('id', idhdr);
    if (hdrUpdErr) throw hdrUpdErr;
  }

  await writeLog('DELETE', 'trs_penjualan_dtl', `Hapus permanen barang terjual ID: ${detailId}, Barang: ${nama_barang}, Code: ${code || '-'}, Qty: ${qty}`);
}


export async function updatePenjualanHeader(id: number, payload: Partial<TrsPenjualanHdr>) {
  const { data, error } = await supabase
    .from('trs_penjualan_hdr')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  await writeLog('UPDATE', 'trs_penjualan_hdr', `Ubah info penjualan ID: ${id} (${payload.customer || 'Umum'})`);

  return data as TrsPenjualanHdr;
}

async function tambahStok(idbarang: number, kategori: string, qty: number) {
  if (kategori === 'Aksesoris') {
    const { data } = await supabase.from('ms_aksesoris').select('qty').eq('id', idbarang).single();
    if (data) {
      await supabase.from('ms_aksesoris').update({ qty: (data.qty || 0) + qty, update_time: new Date().toISOString() }).eq('id', idbarang);
    }
  } else if (kategori === 'Kuota') {
    const { data } = await supabase.from('ms_kuota').select('qty').eq('id', idbarang).single();
    if (data) {
      await supabase.from('ms_kuota').update({ qty: (data.qty || 0) + qty, update_time: new Date().toISOString() }).eq('id', idbarang);
    }
  } else if (kategori === 'HP') {
    await supabase.from('ms_hp_dtl').update({ status: 'tersedia', update_time: new Date().toISOString() }).eq('id', idbarang);
  } else if (kategori === 'HP Non Pajak') {
    await supabase.from('ms_hp_dtl_non_pajak').update({ status: 'tersedia', update_time: new Date().toISOString() }).eq('id', idbarang);
  } else if (kategori === 'CCTV') {
    await supabase.from('ms_cctv_dtl').update({ status: 'tersedia', update_time: new Date().toISOString() }).eq('id', idbarang);
  } else if (kategori === 'Sparepart') {
    const { data } = await supabase.from('ms_sparepart').select('qty').eq('id', idbarang).single();
    if (data) {
      await supabase.from('ms_sparepart').update({ qty: (data.qty || 0) + qty, update_time: new Date().toISOString() }).eq('id', idbarang);
    }
  }
  // E-Wallet and Jasa Service have no inventory – nothing to restore
}

// ============================================
// TRANSAKSI PEMBELIAN
// ============================================

export async function getPembelian() {
  let allData: TrsPembelianHdr[] = [];
  let fromIndex = 0;
  const step = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('trs_pembelian_hdr')
      .select(`*, trs_pembelian_dtl(*)`)
      .order('tanggal_pembelian', { ascending: false })
      .range(fromIndex, fromIndex + step - 1);
      
    if (error) throw error;
    
    if (data) {
      allData = [...allData, ...(data as TrsPembelianHdr[])];
    }
    
    if (!data || data.length < step) {
      break;
    }
    
    fromIndex += step;
  }
  
  return allData;
}

export async function createPembelian(
  header: Omit<TrsPembelianHdr, 'id' | 'create_time' | 'details'>,
  items: Omit<TrsPembelianDtl, 'id' | 'idhdr' | 'create_time'>[]
) {
  const { data: hdr, error: hdrErr } = await supabase
    .from('trs_pembelian_hdr')
    .insert(header)
    .select()
    .single();
  if (hdrErr) throw hdrErr;

  const dtls = items.map(item => ({ ...item, idhdr: hdr.id }));
  const { error: dtlErr } = await supabase
    .from('trs_pembelian_dtl')
    .insert(dtls);
  if (dtlErr) throw dtlErr;

  await writeLog('INSERT', 'trs_pembelian_hdr', `Pembelian dari ${header.supplier}`);

  return hdr as TrsPembelianHdr;
}

// ============================================
// DASHBOARD STATS
// ============================================

export async function getDashboardStats(from?: string, to?: string): Promise<DashboardStats> {
  let query = supabase
    .from('trs_penjualan_dtl')
    .select('harga_jual, harga_modal, qty, trs_penjualan_hdr!inner(status, tanggal_penjualan)');

  if (from) {
    query = query.gte('trs_penjualan_hdr.tanggal_penjualan', from);
  }
  if (to) {
    query = query.lte('trs_penjualan_hdr.tanggal_penjualan', to + 'T23:59:59');
  }

  const { data: salesData, error: salesErr } = await query;
  if (salesErr) throw salesErr;

  let total_pemasukan = 0;
  let total_pengeluaran = 0;

  (salesData ?? []).forEach((row: Record<string, unknown>) => {
    total_pemasukan += (row.harga_jual as number) * (row.qty as number);
    total_pengeluaran += (row.harga_modal as number) * (row.qty as number);
  });

  // Count total products
  const [hp, hpnp, aksesoris, cctv, kuota, sparepart] = await Promise.all([
    supabase.from('ms_hp_dtl').select('id', { count: 'exact' }).or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_hp_dtl_non_pajak').select('id', { count: 'exact' }).or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_aksesoris').select('qty').gt('qty', 0),
    supabase.from('ms_cctv_dtl').select('id', { count: 'exact' }).or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_kuota').select('qty').gt('qty', 0),
    supabase.from('ms_sparepart').select('qty').gt('qty', 0),
  ]);

  const hpStock = hp.count ?? 0;
  const hpnpStock = hpnp.count ?? 0;
  const aksStock = (aksesoris.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.qty as number), 0);
  const cctvStock = cctv.count ?? 0;
  const kuotaStock = (kuota.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.qty as number), 0);
  const sparepartStock = (sparepart.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.qty as number), 0);
  const total_produk = hpStock + hpnpStock + aksStock + cctvStock + kuotaStock + sparepartStock;

  // Total aset = nilai modal stok yang tersedia
  const [hpModal, hpnpModal, aksModal, cctvModal, kuotaModal, sparepartModal] = await Promise.all([
    supabase.from('ms_hp_dtl').select('harga_modal').or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_hp_dtl_non_pajak').select('harga_modal').or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_aksesoris').select('harga_modal, qty').gt('qty', 0),
    supabase.from('ms_cctv_dtl').select('harga_modal').or('status.is.null,status.eq.tersedia'),
    supabase.from('ms_kuota').select('harga_modal, qty').gt('qty', 0),
    supabase.from('ms_sparepart').select('harga_modal, qty').gt('qty', 0),
  ]);

  const hpModalSum = (hpModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0), 0);
  const hpnpModalSum = (hpnpModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0), 0);
  const aksModalSum = (aksModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0) * (r.qty as number ?? 0), 0);
  const cctvModalSum = (cctvModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0), 0);
  const kuotaModalSum = (kuotaModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0) * (r.qty as number ?? 0), 0);
  const sparepartModalSum = (sparepartModal.data ?? []).reduce((sum: number, r: Record<string, unknown>) => sum + (r.harga_modal as number ?? 0) * (r.qty as number ?? 0), 0);

  const total_aset = hpModalSum + hpnpModalSum + aksModalSum + cctvModalSum + kuotaModalSum + sparepartModalSum;

  return {
    total_pemasukan,
    total_pengeluaran,
    total_keuntungan: total_pemasukan - total_pengeluaran,
    total_produk,
    total_aset,
  };
}

export async function getChartData(from?: string, to?: string): Promise<ChartDataPoint[]> {
  let query = supabase
    .from('trs_penjualan_hdr')
    .select(`tanggal_penjualan, trs_penjualan_dtl(harga_jual, harga_modal, qty)`)
    .order('tanggal_penjualan');

  if (from) query = query.gte('tanggal_penjualan', from);
  if (to) query = query.lte('tanggal_penjualan', to + 'T23:59:59');

  const { data, error } = await query;
  if (error) throw error;

  // Group by date
  const grouped: Record<string, ChartDataPoint> = {};
  (data ?? []).forEach((row: Record<string, unknown>) => {
    const date = (row.tanggal_penjualan as string).substring(0, 10);
    if (!grouped[date]) {
      grouped[date] = { tanggal: date, pemasukan: 0, pengeluaran: 0, keuntungan: 0 };
    }
    const dtls = row.trs_penjualan_dtl as Array<{ harga_jual: number; harga_modal: number; qty: number }>;
    (dtls ?? []).forEach(d => {
      grouped[date].pemasukan += d.harga_jual * d.qty;
      grouped[date].pengeluaran += d.harga_modal * d.qty;
    });
    grouped[date].keuntungan = grouped[date].pemasukan - grouped[date].pengeluaran;
  });

  return Object.values(grouped);
}

export async function getKategoriSales(from?: string, to?: string): Promise<KategoriSales[]> {
  let query = supabase
    .from('trs_penjualan_dtl')
    .select('kategori, qty, harga_jual, trs_penjualan_hdr!inner(status, tanggal_penjualan)');

  if (from) query = query.gte('trs_penjualan_hdr.tanggal_penjualan', from);
  if (to) query = query.lte('trs_penjualan_hdr.tanggal_penjualan', to + 'T23:59:59');

  const { data, error } = await query;
  if (error) throw error;

  const grouped: Record<string, KategoriSales> = {};
  (data ?? []).forEach((row: Record<string, unknown>) => {
    const kat = row.kategori as string;
    if (!grouped[kat]) grouped[kat] = { kategori: kat, jumlah: 0, total: 0 };
    grouped[kat].jumlah += row.qty as number;
    grouped[kat].total += (row.harga_jual as number) * (row.qty as number);
  });

  return Object.values(grouped);
}

// ============================================
// SEARCH FOR POS (barcode scan)
// ============================================

export async function searchBarcode(barcode: string) {
  // Search in aksesoris
  const { data: aks } = await supabase
    .from('ms_aksesoris')
    .select('*')
    .eq('barcode', barcode)
    .gt('qty', 0)
    .single();

  if (aks) {
    return {
      idbarang: aks.id,
      kategori: 'Aksesoris' as const,
      code: aks.barcode,
      nama_barang: `${aks.merk} ${aks.nama}`,
      qty: 1,
      harga_modal: aks.harga_modal,
      harga_jual: aks.harga_jual,
      supplier: aks.supplier,
      max_qty: aks.qty,
    };
  }

  // Search in sparepart
  const { data: spr } = await supabase
    .from('ms_sparepart')
    .select('*')
    .eq('barcode', barcode)
    .gt('qty', 0)
    .single();

  if (spr) {
    return {
      idbarang: spr.id,
      kategori: 'Sparepart' as const,
      code: spr.barcode,
      nama_barang: `${spr.merk} ${spr.nama}`,
      qty: 1,
      harga_modal: spr.harga_modal,
      harga_jual: spr.harga_jual,
      supplier: spr.supplier,
      max_qty: spr.qty,
    };
  }

  // Search in kuota
  const { data: kuo } = await supabase
    .from('ms_kuota')
    .select('*')
    .eq('barcode', barcode)
    .gt('qty', 0)
    .single();

  if (kuo) {
    return {
      idbarang: kuo.id,
      kategori: 'Kuota' as const,
      code: kuo.barcode,
      nama_barang: `${kuo.operator} ${kuo.description}`,
      qty: 1,
      harga_modal: kuo.harga_modal,
      harga_jual: kuo.harga_jual,
      supplier: kuo.supplier,
      max_qty: kuo.qty,
    };
  }

  // Search HP by IMEI
  const { data: hp } = await supabase
    .from('ms_hp_dtl')
    .select('*, ms_hp_hdr(nama, merk, supplier)')
    .eq('imei', barcode)
    .or('status.is.null,status.eq.tersedia')
    .single();

  if (hp) {
    const hdr = (hp as Record<string, unknown>).ms_hp_hdr as Record<string, string>;
    return {
      idbarang: hp.id,
      kategori: 'HP' as const,
      code: hp.imei,
      nama_barang: `${hdr?.merk} ${hdr?.nama}`,
      qty: 1,
      harga_modal: hp.harga_modal,
      harga_jual: hp.harga_jual,
      supplier: hdr?.supplier,
      max_qty: 1,
    };
  }

  // Search HP Non Pajak by IMEI
  const { data: hpnp } = await supabase
    .from('ms_hp_dtl_non_pajak')
    .select('*, ms_hp_hdr_non_pajak(nama, merk, supplier)')
    .eq('imei', barcode)
    .or('status.is.null,status.eq.tersedia')
    .single();

  if (hpnp) {
    const hdr = (hpnp as Record<string, unknown>).ms_hp_hdr_non_pajak as Record<string, string>;
    return {
      idbarang: hpnp.id,
      kategori: 'HP Non Pajak' as const,
      code: hpnp.imei,
      nama_barang: `${hdr?.merk} ${hdr?.nama} (Non Pajak)`,
      qty: 1,
      harga_modal: hpnp.harga_modal,
      harga_jual: hpnp.harga_jual,
      supplier: hdr?.supplier,
      max_qty: 1,
    };
  }

  // Search CCTV by SN
  const { data: cctv } = await supabase
    .from('ms_cctv_dtl')
    .select('*, ms_cctv_hdr(nama, merk, supplier)')
    .eq('sn_cctv', barcode)
    .or('status.is.null,status.eq.tersedia')
    .single();

  if (cctv) {
    const hdr = (cctv as Record<string, unknown>).ms_cctv_hdr as Record<string, string>;
    return {
      idbarang: cctv.id,
      kategori: 'CCTV' as const,
      code: cctv.sn_cctv,
      nama_barang: `${hdr?.merk} ${hdr?.nama}`,
      qty: 1,
      harga_modal: cctv.harga_modal,
      harga_jual: cctv.harga_jual,
      supplier: hdr?.supplier,
      max_qty: 1,
    };
  }

  return null;
}

export async function searchProductsByName(query: string) {
  const q = `%${query}%`;
  const results: any[] = [];

  // 1. Aksesoris
  const { data: aks } = await supabase
    .from('ms_aksesoris')
    .select('*')
    .or(`nama.ilike.${q},merk.ilike.${q}`)
    .gt('qty', 0);
  
  if (aks) {
    aks.forEach(item => {
      results.push({
        idbarang: item.id,
        kategori: 'Aksesoris' as const,
        code: item.barcode,
        nama_barang: `${item.merk} ${item.nama}`,
        qty: 1,
        harga_modal: item.harga_modal,
        harga_jual: item.harga_jual,
        supplier: item.supplier,
        max_qty: item.qty,
      });
    });
  }

  // 2. Kuota
  const { data: kuo } = await supabase
    .from('ms_kuota')
    .select('*')
    .or(`description.ilike.${q},operator.ilike.${q}`)
    .gt('qty', 0);
  
  if (kuo) {
    kuo.forEach(item => {
      results.push({
        idbarang: item.id,
        kategori: 'Kuota' as const,
        code: item.barcode,
        nama_barang: `${item.operator} ${item.description}`,
        qty: 1,
        harga_modal: item.harga_modal,
        harga_jual: item.harga_jual,
        supplier: item.supplier,
        max_qty: item.qty,
      });
    });
  }

  // 3. HP
  const { data: hp } = await supabase
    .from('ms_hp_dtl')
    .select('*, ms_hp_hdr(nama, merk, supplier)')
    .or('status.is.null,status.eq.tersedia');
  
  if (hp) {
    hp.forEach(item => {
      const hdr = (item as any).ms_hp_hdr;
      const namaFull = `${hdr?.merk} ${hdr?.nama}`;
      if (namaFull.toLowerCase().includes(query.toLowerCase()) || item.imei.includes(query)) {
        results.push({
          idbarang: item.id,
          kategori: 'HP' as const,
          code: item.imei,
          nama_barang: namaFull,
          qty: 1,
          harga_modal: item.harga_modal,
          harga_jual: item.harga_jual,
          supplier: hdr?.supplier,
          max_qty: 1,
        });
      }
    });
  }

  // 4. HP Non Pajak
  const { data: hpnp } = await supabase
    .from('ms_hp_dtl_non_pajak')
    .select('*, ms_hp_hdr_non_pajak(nama, merk, supplier)')
    .or('status.is.null,status.eq.tersedia');
  
  if (hpnp) {
    hpnp.forEach(item => {
      const hdr = (item as any).ms_hp_hdr_non_pajak;
      const namaFull = `${hdr?.merk} ${hdr?.nama} (Non Pajak)`;
      if (namaFull.toLowerCase().includes(query.toLowerCase()) || item.imei.includes(query)) {
        results.push({
          idbarang: item.id,
          kategori: 'HP Non Pajak' as const,
          code: item.imei,
          nama_barang: namaFull,
          qty: 1,
          harga_modal: item.harga_modal,
          harga_jual: item.harga_jual,
          supplier: hdr?.supplier,
          max_qty: 1,
        });
      }
    });
  }

  // 5. CCTV
  const { data: cctv } = await supabase
    .from('ms_cctv_dtl')
    .select('*, ms_cctv_hdr(nama, merk, supplier)')
    .or('status.is.null,status.eq.tersedia');
  
  if (cctv) {
    cctv.forEach(item => {
      const hdr = (item as any).ms_cctv_hdr;
      const namaFull = `${hdr?.merk} ${hdr?.nama}`;
      if (namaFull.toLowerCase().includes(query.toLowerCase()) || item.sn_cctv.includes(query)) {
        results.push({
          idbarang: item.id,
          kategori: 'CCTV' as const,
          code: item.sn_cctv,
          nama_barang: namaFull,
          qty: 1,
          harga_modal: item.harga_modal,
          harga_jual: item.harga_jual,
          supplier: hdr?.supplier,
          max_qty: 1,
        });
      }
    });
  }

  // 6. Sparepart
  const { data: sprList } = await supabase
    .from('ms_sparepart')
    .select('*')
    .or(`nama.ilike.${q},merk.ilike.${q}`)
    .gt('qty', 0);
  
  if (sprList) {
    sprList.forEach(item => {
      results.push({
        idbarang: item.id,
        kategori: 'Sparepart' as const,
        code: item.barcode,
        nama_barang: `${item.merk} ${item.nama}`,
        qty: 1,
        harga_modal: item.harga_modal,
        harga_jual: item.harga_jual,
        supplier: item.supplier,
        max_qty: item.qty,
      });
    });
  }

  return results;
}

// ============================================
// LOG HISTORI / AUDIT TRAIL
// ============================================

export async function writeLog(aksi: string, tabel: string, detail: string) {
  try {
    const user = getCurrentUser();
    const username = user?.username ?? 'system';
    await supabase.from('log_aktivitas').insert({
      username,
      aksi,
      tabel,
      detail,
      waktu: new Date().toISOString()
    });
  } catch (e) {
    console.error('Gagal menulis log:', e);
  }
}

export async function getLogs() {
  const { data, error } = await supabase
    .from('log_aktivitas')
    .select('*')
    .order('waktu', { ascending: false });
  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    id: row.id,
    user: row.username,
    aksi: row.aksi,
    tabel: row.tabel,
    detail: row.detail,
    waktu: row.waktu
  }));
}

export async function getItemEntryLogs() {
  const { data, error } = await supabase
    .from('log_aktivitas')
    .select('*')
    .eq('aksi', 'INSERT')
    .in('tabel', ['ms_aksesoris', 'ms_kuota', 'ms_hp_dtl', 'ms_hp_dtl_non_pajak', 'ms_cctv_dtl', 'ms_sparepart'])
    .order('waktu', { ascending: false });
  if (error) throw error;
  
  return (data || []).map((row: any) => ({
    id: row.id,
    user: row.username,
    aksi: row.aksi,
    tabel: row.tabel,
    detail: row.detail,
    waktu: row.waktu
  }));
}

// ============================================
// USER MANAGEMENT
// ============================================

export async function getUsers() {
  const { data, error } = await supabase
    .from('ms_user')
    .select('*')
    .order('create_time');
  if (error) throw error;
  return data as any[];
}

export async function createUser(payload: any) {
  const { data, error } = await supabase
    .from('ms_user')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUser(id: number, payload: any) {
  const { data, error } = await supabase
    .from('ms_user')
    .update({ ...payload, update_time: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUser(id: number) {
  const { error } = await supabase
    .from('ms_user')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================
// WARRANTY (GARANSI) DATA HELPERS
// ============================================

function getLocalGaransi(): MsGaransi[] {
  if (typeof window === 'undefined') return [];
  const local = localStorage.getItem('local_garansi');
  return local ? JSON.parse(local) : [];
}

function saveLocalGaransi(data: MsGaransi[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('local_garansi', JSON.stringify(data));
  }
}

export async function getGaransi() {
  try {
    const { data, error } = await supabase
      .from('garansi')
      .select('*')
      .order('create_time', { ascending: false });
    
    if (error) {
      console.warn('Supabase error, using localStorage fallback:', error);
      return getLocalGaransi();
    }
    return data as MsGaransi[];
  } catch (e) {
    console.warn('Supabase exception, using localStorage fallback:', e);
    return getLocalGaransi();
  }
}

export async function createGaransi(payload: Omit<MsGaransi, 'id' | 'create_time'>) {
  try {
    const { data, error } = await supabase
      .from('garansi')
      .insert(payload)
      .select()
      .single();
    
    if (error) {
      console.warn('Supabase error, using localStorage fallback:', error);
      const local = getLocalGaransi();
      const newEntry: MsGaransi = {
        ...payload,
        id: Date.now(),
        create_time: new Date().toISOString(),
      };
      local.unshift(newEntry);
      saveLocalGaransi(local);
      await writeLog('INSERT', 'garansi (local)', `Tambah Garansi Local: ${payload.nama_pelanggan} - HP: ${payload.merk_tipe}`);
      return newEntry;
    }
    
    await writeLog('INSERT', 'garansi', `Tambah Garansi: ${payload.nama_pelanggan} - HP: ${payload.merk_tipe}`);
    return data as MsGaransi;
  } catch (e) {
    console.warn('Supabase exception, using localStorage fallback:', e);
    const local = getLocalGaransi();
    const newEntry: MsGaransi = {
      ...payload,
      id: Date.now(),
      create_time: new Date().toISOString(),
    };
    local.unshift(newEntry);
    saveLocalGaransi(local);
    await writeLog('INSERT', 'garansi (local)', `Tambah Garansi Local: ${payload.nama_pelanggan} - HP: ${payload.merk_tipe}`);
    return newEntry;
  }
}

export async function updateGaransi(id: number, payload: Partial<MsGaransi>) {
  try {
    const { data, error } = await supabase
      .from('garansi')
      .update({ ...payload, update_time: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.warn('Supabase error, using localStorage fallback:', error);
      const local = getLocalGaransi();
      const idx = local.findIndex(item => item.id === id);
      if (idx !== -1) {
        local[idx] = {
          ...local[idx],
          ...payload,
          update_time: new Date().toISOString(),
        };
        saveLocalGaransi(local);
        return local[idx];
      }
      throw new Error('Data tidak ditemukan di localStorage');
    }
    return data as MsGaransi;
  } catch (e) {
    console.warn('Supabase exception, using localStorage fallback:', e);
    const local = getLocalGaransi();
    const idx = local.findIndex(item => item.id === id);
    if (idx !== -1) {
      local[idx] = {
        ...local[idx],
        ...payload,
        update_time: new Date().toISOString(),
      };
      saveLocalGaransi(local);
      return local[idx];
    }
    throw e;
  }
}

export async function deleteGaransi(id: number) {
  try {
    const { error } = await supabase.from('garansi').delete().eq('id', id);
    if (error) {
      console.warn('Supabase error, using localStorage fallback:', error);
      const local = getLocalGaransi();
      const filtered = local.filter(item => item.id !== id);
      saveLocalGaransi(filtered);
      return;
    }
  } catch (e) {
    console.warn('Supabase exception, using localStorage fallback:', e);
    const local = getLocalGaransi();
    const filtered = local.filter(item => item.id !== id);
    saveLocalGaransi(filtered);
  }
}


