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
  MsBarang,
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

// ============================================
// NEON DB CLOUD & OFFLINE HELPER
// ============================================

export async function callNeonApi(action: string, payload?: any, method: 'GET' | 'POST' = 'GET') {
  if (typeof window === 'undefined') return null;
  try {
    const url = method === 'GET'
      ? `/api/neon?action=${action}${payload ? '&' + new URLSearchParams(payload).toString() : ''}`
      : '/api/neon';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ action, payload }) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? json.data : null;
  } catch {
    // Offline / Network Error - fallback to local storage
    return null;
  }
}

export async function getKategoris(): Promise<MsKategori[]> {
  const neonData = await callNeonApi('getKategoris');
  if (neonData && Array.isArray(neonData) && neonData.length > 0) {
    saveLocalKategoris(neonData as MsKategori[]);
    return neonData as MsKategori[];
  }
  return getLocalKategoris();
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

  const neonRes = await callNeonApi('createKategori', payload, 'POST');
  if (neonRes) {
    saveLocalKategoris([...localList, neonRes as MsKategori]);
    return neonRes as MsKategori;
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

  const neonRes = await callNeonApi('updateKategori', { id, ...payload }, 'POST');
  if (neonRes) {
    if (index >= 0) localList[index] = neonRes as MsKategori;
    saveLocalKategoris(localList);
    return neonRes as MsKategori;
  }

  if (index >= 0) {
    localList[index] = updatedItem;
    saveLocalKategoris(localList);
  }
  return updatedItem;
}

export async function deleteKategori(id: number): Promise<void> {
  await callNeonApi('deleteKategori', { id }, 'POST');
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
// MASTER BARANG / PRODUK STOCK (KELONTONG & BAJU)
// ============================================

export const DEFAULT_BARANG_PRESETS: Omit<MsBarang, 'id' | 'create_time'>[] = [
  // Contoh Barang Kelontong
  { barcode: '8992753210111', nama: 'Beras Rojo Lele 5kg', kategori: 'Sembako', merk: 'Rojo Lele', supplier: 'Distributor Sembako Jaya', satuan: 'Kg', qty: 25, harga_modal: 68000, harga_jual: 75000, keterangan: 'Beras pulen super' },
  { barcode: '8998866200222', nama: 'Minyak Goreng Bimoli 2L', kategori: 'Sembako', merk: 'Bimoli', supplier: 'Distributor Sembako Jaya', satuan: 'Pcs', qty: 40, harga_modal: 32000, harga_jual: 36000, keterangan: 'Minyak kelapa sawit murni' },
  { barcode: '8999909001234', nama: 'Indomie Goreng Original', kategori: 'Makanan & Snack', merk: 'Indofood', supplier: 'PT Sumber Pangan', satuan: 'Bungkus', qty: 150, harga_modal: 2900, harga_jual: 3500, keterangan: 'Mie instan goreng' },
  { barcode: '8991389221144', nama: 'Le Minerale 600ml', kategori: 'Minuman', merk: 'Mayora', supplier: 'PT Tirta Mas', satuan: 'Botol', qty: 80, harga_modal: 2500, harga_jual: 3500, keterangan: 'Air mineral pegunungan' },
  { barcode: '8992745321100', nama: 'Kecap Bango Manis Refill 550ml', kategori: 'Bumbu & Bahan Masak', merk: 'Bango', supplier: 'PT Sumber Pangan', satuan: 'Pouch', qty: 35, harga_modal: 21000, harga_jual: 24500, keterangan: 'Kecap kedelai hitam pilihan' },
  { barcode: '8998833110022', nama: 'Sabun Mandi Lifebuoy Total 10 85g', kategori: 'Kebersihan & Mandi', merk: 'Lifebuoy', supplier: 'PT Surya Niaga', satuan: 'Pcs', qty: 60, harga_modal: 3800, harga_jual: 5000, keterangan: 'Sabun batang antibakteri' },
  { barcode: '8991122334455', nama: 'Sampoerna A Mild 16', kategori: 'Rokok & Tembakau', merk: 'Sampoerna', supplier: 'Grosir Tembakau', satuan: 'Bungkus', qty: 50, harga_modal: 31000, harga_jual: 34000, keterangan: 'Rokok filter premium' },
  { barcode: '8995566778899', nama: 'Gas Elpiji 3 Kg (Isi Ulang)', kategori: 'Gas & Galon', merk: 'Pertamina', supplier: 'Pangkalan Gas Resmi', satuan: 'Tabung', qty: 20, harga_modal: 18000, harga_jual: 22000, keterangan: 'Gas melon 3kg' },
  // Contoh Barang Baju
  { barcode: 'BJ-KAOS-001', nama: 'Kaos Polos Cotton Combed 30s Hitam', kategori: 'Kaos & T-Shirt', merk: 'New States', supplier: 'Konveksi Bandung', satuan: 'Pcs', ukuran: 'L', warna: 'Hitam', qty: 30, harga_modal: 38000, harga_jual: 65000, keterangan: 'Bahan adem 100% cotton' },
  { barcode: 'BJ-KMJ-002', nama: 'Kemeja Flanel Lengan Panjang Pria', kategori: 'Kemeja Pria & Wanita', merk: 'Erigo', supplier: 'Distro Garment', satuan: 'Pcs', ukuran: 'XL', warna: 'Merah Hitam', qty: 15, harga_modal: 75000, harga_jual: 125000, keterangan: 'Kemeja casual' },
  { barcode: 'BJ-CLN-003', nama: 'Celana Chino Slim Fit Pria', kategori: 'Celana & Rok', merk: 'Cardinal', supplier: 'Distro Garment', satuan: 'Pcs', ukuran: '32', warna: 'Khaki', qty: 20, harga_modal: 90000, harga_jual: 150000, keterangan: 'Bahan katun twill stretch' },
  { barcode: 'BJ-GMS-004', nama: 'Gamis Katun Rayon Premium Wanita', kategori: 'Gamis & Busana Muslim', merk: 'Zoya', supplier: 'Grosir Busana Muslim', satuan: 'Pcs', ukuran: 'All Size', warna: 'Sage Green', qty: 12, harga_modal: 110000, harga_jual: 175000, keterangan: 'Busana muslim wanita' },
];

export function getLocalBarangs(): MsBarang[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem('local_ms_barang');
  if (!raw) {
    const initial: MsBarang[] = DEFAULT_BARANG_PRESETS.map((p, idx) => ({
      ...p,
      id: idx + 1,
      create_time: new Date().toISOString(),
    }));
    localStorage.setItem('local_ms_barang', JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalBarangs(data: MsBarang[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('local_ms_barang', JSON.stringify(data));
  }
}

export async function getBarangs(kategori?: string): Promise<MsBarang[]> {
  const neonData = await callNeonApi('getBarangs', kategori ? { kategori } : undefined);
  if (neonData && Array.isArray(neonData) && neonData.length > 0) {
    saveLocalBarangs(neonData as MsBarang[]);
    return neonData as MsBarang[];
  }
  const locals = getLocalBarangs();
  return (kategori && kategori !== 'semua') ? locals.filter(b => b.kategori === kategori) : locals;
}

export async function createBarang(payload: Omit<MsBarang, 'id' | 'create_time'>): Promise<MsBarang> {
  const locals = getLocalBarangs();
  const nextId = locals.length > 0 ? Math.max(...locals.map(b => b.id)) + 1 : 1;
  const newRecord: MsBarang = {
    ...payload,
    id: nextId,
    create_time: new Date().toISOString(),
  };

  const neonRes = await callNeonApi('createBarang', payload, 'POST');
  if (neonRes) {
    saveLocalBarangs([neonRes as MsBarang, ...locals]);
    return neonRes as MsBarang;
  }

  saveLocalBarangs([newRecord, ...locals]);
  return newRecord;
}

export async function updateBarang(id: number, payload: Partial<MsBarang>): Promise<MsBarang> {
  const locals = getLocalBarangs();
  const index = locals.findIndex(b => b.id === id);
  const updatedItem: MsBarang = {
    ...(index >= 0 ? locals[index] : ({} as MsBarang)),
    ...payload,
    id,
    update_time: new Date().toISOString(),
  };

  const neonRes = await callNeonApi('updateBarang', { id, ...payload }, 'POST');
  if (neonRes) {
    if (index >= 0) locals[index] = neonRes as MsBarang;
    saveLocalBarangs(locals);
    return neonRes as MsBarang;
  }

  if (index >= 0) {
    locals[index] = updatedItem;
    saveLocalBarangs(locals);
  }
  return updatedItem;
}

export async function deleteBarang(id: number): Promise<void> {
  await callNeonApi('deleteBarang', { id }, 'POST');
  const locals = getLocalBarangs().filter(b => b.id !== id);
  saveLocalBarangs(locals);
}

// ============================================
// MASTER DATA (MERK, OPERATOR, SUPPLIER)
// ============================================

export async function getMerks(): Promise<MsMerk[]> {
  try {
    const neonRes = await callNeonApi('getMerks');
    if (neonRes && Array.isArray(neonRes)) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_merk', JSON.stringify(neonRes));
      return neonRes as MsMerk[];
    }
  } catch {
    // ignore
  }

  try {
    const { data, error } = await supabase.from('ms_merk').select('*').order('nama');
    if (!error && data && data.length > 0) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_merk', JSON.stringify(data));
      return data as MsMerk[];
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('local_ms_merk');
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return [];
}

export async function createMerk(payload: Omit<MsMerk, 'id' | 'create_time'>): Promise<MsMerk> {
  const neonRes = await callNeonApi('createMerk', payload, 'POST');
  if (neonRes) {
    const current = await getMerks();
    if (typeof window !== 'undefined') localStorage.setItem('local_ms_merk', JSON.stringify([...current, neonRes]));
    return neonRes as MsMerk;
  }
  try {
    const { data } = await supabase.from('ms_merk').insert(payload).select().single();
    if (data) return data as MsMerk;
  } catch {}
  const fallback = { ...payload, id: Date.now(), create_time: new Date().toISOString() };
  return fallback as MsMerk;
}

export async function updateMerk(id: number, payload: Partial<MsMerk>): Promise<MsMerk> {
  try {
    const { data } = await supabase.from('ms_merk').update({ ...payload, update_time: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data as MsMerk;
  } catch {}
  return { ...payload, id } as MsMerk;
}

export async function deleteMerk(id: number): Promise<void> {
  await callNeonApi('deleteMerk', { id }, 'POST');
  try {
    await supabase.from('ms_merk').delete().eq('id', id);
  } catch {}
  if (typeof window !== 'undefined') {
    const current = await getMerks();
    localStorage.setItem('local_ms_merk', JSON.stringify(current.filter(m => m.id !== id)));
  }
}

export async function getOperators(): Promise<MsOperator[]> {
  try {
    const neonRes = await callNeonApi('getOperators');
    if (neonRes && Array.isArray(neonRes)) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_operator', JSON.stringify(neonRes));
      return neonRes as MsOperator[];
    }
  } catch {}

  try {
    const { data, error } = await supabase.from('ms_operator').select('*').order('nama');
    if (!error && data && data.length > 0) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_operator', JSON.stringify(data));
      return data as MsOperator[];
    }
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('local_ms_operator');
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return [];
}

export async function createOperator(payload: Omit<MsOperator, 'id' | 'create_time'>): Promise<MsOperator> {
  const neonRes = await callNeonApi('createOperator', payload, 'POST');
  if (neonRes) {
    const current = await getOperators();
    if (typeof window !== 'undefined') localStorage.setItem('local_ms_operator', JSON.stringify([...current, neonRes]));
    return neonRes as MsOperator;
  }
  try {
    const { data } = await supabase.from('ms_operator').insert(payload).select().single();
    if (data) return data as MsOperator;
  } catch {}
  const fallback = { ...payload, id: Date.now(), create_time: new Date().toISOString() };
  return fallback as MsOperator;
}

export async function updateOperator(id: number, payload: Partial<MsOperator>): Promise<MsOperator> {
  try {
    const { data } = await supabase.from('ms_operator').update({ ...payload, update_time: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data as MsOperator;
  } catch {}
  return { ...payload, id } as MsOperator;
}

export async function deleteOperator(id: number): Promise<void> {
  await callNeonApi('deleteOperator', { id }, 'POST');
  try {
    await supabase.from('ms_operator').delete().eq('id', id);
  } catch {}
  if (typeof window !== 'undefined') {
    const current = await getOperators();
    localStorage.setItem('local_ms_operator', JSON.stringify(current.filter(m => m.id !== id)));
  }
}

export async function getSuppliers(): Promise<MsSupplier[]> {
  try {
    const neonRes = await callNeonApi('getSuppliers');
    if (neonRes && Array.isArray(neonRes)) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_supplier', JSON.stringify(neonRes));
      return neonRes as MsSupplier[];
    }
  } catch {}

  try {
    const { data, error } = await supabase.from('ms_supplier').select('*').order('nama');
    if (!error && data && data.length > 0) {
      if (typeof window !== 'undefined') localStorage.setItem('local_ms_supplier', JSON.stringify(data));
      return data as MsSupplier[];
    }
  } catch {}

  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('local_ms_supplier');
      if (cached) return JSON.parse(cached);
    } catch {}
  }
  return [];
}

export async function createSupplier(payload: Omit<MsSupplier, 'id' | 'create_time'>): Promise<MsSupplier> {
  const neonRes = await callNeonApi('createSupplier', payload, 'POST');
  if (neonRes) {
    const current = await getSuppliers();
    if (typeof window !== 'undefined') localStorage.setItem('local_ms_supplier', JSON.stringify([...current, neonRes]));
    return neonRes as MsSupplier;
  }
  try {
    const { data } = await supabase.from('ms_supplier').insert(payload).select().single();
    if (data) return data as MsSupplier;
  } catch {}
  const fallback = { ...payload, id: Date.now(), create_time: new Date().toISOString() };
  return fallback as MsSupplier;
}

export async function updateSupplier(id: number, payload: Partial<MsSupplier>): Promise<MsSupplier> {
  try {
    const { data } = await supabase.from('ms_supplier').update({ ...payload, update_time: new Date().toISOString() }).eq('id', id).select().single();
    if (data) return data as MsSupplier;
  } catch {}
  return { ...payload, id } as MsSupplier;
}

export async function deleteSupplier(id: number): Promise<void> {
  await callNeonApi('deleteSupplier', { id }, 'POST');
  try {
    await supabase.from('ms_supplier').delete().eq('id', id);
  } catch {}
  if (typeof window !== 'undefined') {
    const current = await getSuppliers();
    localStorage.setItem('local_ms_supplier', JSON.stringify(current.filter(m => m.id !== id)));
  }
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

export async function getPenjualan(from?: string, to?: string): Promise<TrsPenjualanHdr[]> {
  // 1. Coba ambil dari Neon DB via /api/neon
  try {
    const neonRes = await callNeonApi('getPenjualan', from || to ? { from: from || '', to: to || '' } : undefined);
    if (neonRes && Array.isArray(neonRes)) {
      // Gabungkan dengan transaksi lokal yang belum tersinkron
      const pendingLocal = getOfflineSales().filter(s => !s.synced);
      const pendingFormatted: TrsPenjualanHdr[] = pendingLocal.map((off, idx) => ({
        id: -1 * (idx + 1),
        nomor_invoice: off.invoice,
        customer: off.header?.customer || 'Umum',
        status: 1,
        tanggal_penjualan: off.header?.tanggal_penjualan || off.timestamp,
        metode_pembayaran: off.header?.metode_pembayaran || 'Tunai',
        total_harga: off.header?.total_harga || 0,
        catatan: off.header?.catatan || '(Offline)',
        create_time: off.timestamp,
        create_by: off.header?.create_by || 'kasir',
        details: (off.items || []).map((it, dIdx) => ({
          id: -1 * (dIdx + 1),
          idhdr: -1 * (idx + 1),
          idbarang: it.idbarang || 0,
          kategori: it.kategori,
          code: it.code,
          nama_barang: it.nama_barang,
          qty: it.qty,
          harga_modal: it.harga_modal,
          harga_jual: it.harga_jual,
          supplier: it.supplier,
          create_time: off.timestamp,
        })),
      }));

      const neonInvoices = new Set(neonRes.map((r: any) => r.nomor_invoice));
      const filteredPending = pendingFormatted.filter(p => !neonInvoices.has(p.nomor_invoice));

      const merged = [...filteredPending, ...neonRes].map((r: any) => {
        const dtls = r.details || r.trs_penjualan_dtl || [];
        return {
          ...r,
          details: dtls,
          trs_penjualan_dtl: dtls,
        };
      });

      return merged as TrsPenjualanHdr[];
    }
  } catch {
    // Offline mode
  }

  // 2. Coba Supabase jika ada
  try {
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
        query = query.gte('tanggal_penjualan', from + 'T00:00:00Z');
      }
      if (to) {
        query = query.lte('tanggal_penjualan', to + 'T23:59:59Z');
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) break;
      const normalized = (data as any[]).map(d => ({
        ...d,
        details: d.details || d.trs_penjualan_dtl || [],
        trs_penjualan_dtl: d.details || d.trs_penjualan_dtl || [],
      }));
      allData = [...allData, ...normalized];
      if (data.length < step) break;
      fromIndex += step;
    }
    if (allData.length > 0) return allData;
  } catch {
    // ignore
  }

  // 3. Fallback ke offline local sales (agar aplikasi tidak pernah crash!)
  const localSales = getOfflineSales();
  return localSales.map((off, idx) => {
    const items = (off.items || []).map((it, dIdx) => ({
      id: -1 * (dIdx + 1),
      idhdr: -1 * (idx + 1),
      idbarang: it.idbarang || 0,
      kategori: it.kategori,
      code: it.code,
      nama_barang: it.nama_barang,
      qty: it.qty,
      harga_modal: it.harga_modal,
      harga_jual: it.harga_jual,
      supplier: it.supplier,
      create_time: off.timestamp,
    }));
    return {
      id: -1 * (idx + 1),
      nomor_invoice: off.invoice,
      customer: off.header?.customer || 'Umum',
      status: 1,
      tanggal_penjualan: off.header?.tanggal_penjualan || off.timestamp,
      metode_pembayaran: off.header?.metode_pembayaran || 'Tunai',
      total_harga: off.header?.total_harga || 0,
      catatan: off.header?.catatan || '(Offline)',
      create_time: off.timestamp,
      create_by: off.header?.create_by || 'kasir',
      details: items,
      trs_penjualan_dtl: items,
    };
  }) as TrsPenjualanHdr[];
}

export interface OfflineSale {
  invoice: string;
  header: any;
  items: any[];
  synced: boolean;
  timestamp: string;
}

export function getOfflineSales(): OfflineSale[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('local_offline_sales') || '[]');
  } catch {
    return [];
  }
}

export async function syncPendingSalesToNeon(): Promise<number> {
  const all = getOfflineSales();
  const pending = all.filter(s => !s.synced);
  if (pending.length === 0) return 0;

  let count = 0;
  for (const sale of pending) {
    try {
      const res = await callNeonApi('syncPenjualan', { header: sale.header, items: sale.items }, 'POST');
      if (res) {
        sale.synced = true;
        count++;
      }
    } catch {
      // still offline
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('local_offline_sales', JSON.stringify(all));
  }
  return count;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingSalesToNeon().catch(console.error);
  });
}

export async function createPenjualan(
  header: Omit<TrsPenjualanHdr, 'id' | 'create_time' | 'details'>,
  items: Omit<TrsPenjualanDtl, 'id' | 'idhdr' | 'create_time'>[]
) {
  // 1. Kurangi stok lokal terlebih dahulu (agar kasir offline langsung akurat)
  for (const item of items) {
    await kurangiStok(item.idbarang, item.kategori as string, item.qty, item.code);
  }

  // 2. Simpan transaksi ke antrean lokal (offline queue)
  const saleRecord: OfflineSale = {
    invoice: header.nomor_invoice,
    header,
    items,
    synced: false,
    timestamp: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    const existing = getOfflineSales();
    localStorage.setItem('local_offline_sales', JSON.stringify([saleRecord, ...existing]));
  }

  // 3. Coba kirim langsung ke Neon DB
  try {
    const neonRes = await callNeonApi('syncPenjualan', { header, items }, 'POST');
    if (neonRes) {
      saleRecord.synced = true;
      if (typeof window !== 'undefined') {
        const existing = getOfflineSales();
        const updated = existing.map(s => s.invoice === header.nomor_invoice ? { ...s, synced: true } : s);
        localStorage.setItem('local_offline_sales', JSON.stringify(updated));
      }
    }
  } catch {
    // Offline mode: transaksi tetap aman di localStorage, akan disinkronkan otomatis saat online
  }

  // Coba Supabase jika ada
  try {
    const { data: hdr } = await supabase.from('trs_penjualan_hdr').insert(header).select().single();
    if (hdr) {
      const dtls = items.map(item => ({ ...item, idhdr: hdr.id }));
      await supabase.from('trs_penjualan_dtl').insert(dtls);
    }
  } catch {
    // ignore
  }

  await writeLog('INSERT', 'trs_penjualan_hdr', `Penjualan ${header.nomor_invoice} — Total: ${formatRupiah(header.total_harga || 0)}`);

  return {
    ...header,
    id: Date.now(),
    create_time: new Date().toISOString(),
  } as TrsPenjualanHdr;
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
  } else {
    // ms_barang (Kelontong & Baju)
    try {
      const { data: b } = await supabase.from('ms_barang').select('qty').eq('id', idbarang).single();
      if (b) {
        await supabase.from('ms_barang').update({ qty: Math.max(0, (b.qty || 0) - qty), update_time: new Date().toISOString() }).eq('id', idbarang);
      }
    } catch {
      // ignore
    }
    const locals = getLocalBarangs();
    const idx = locals.findIndex(b => b.id === idbarang || b.barcode === code);
    if (idx >= 0) {
      locals[idx].qty = Math.max(0, locals[idx].qty - qty);
      saveLocalBarangs(locals);
    }
  }
  // E-Wallet and Jasa Service have no inventory – nothing to reduce
}

export async function deletePenjualan(id: number) {
  // 1. Jika transaksi lokal offline (id < 0)
  if (id < 0) {
    const localSales = getOfflineSales();
    const targetIdx = localSales.findIndex((_, idx) => -1 * (idx + 1) === id);
    if (targetIdx >= 0) {
      const removed = localSales[targetIdx];
      // Kembalikan stok
      for (const item of removed.items || []) {
        await tambahStok(item.idbarang, item.kategori, item.qty);
      }
      localSales.splice(targetIdx, 1);
      if (typeof window !== 'undefined') {
        localStorage.setItem('local_offline_sales', JSON.stringify(localSales));
      }
    }
    return;
  }

  // 2. Transaksi Cloud (Neon DB)
  try {
    await callNeonApi('deletePenjualan', { id }, 'POST');
  } catch {}

  // 3. Fallback Supabase
  try {
    const { data: dtls } = await supabase.from('trs_penjualan_dtl').select('*').eq('idhdr', id);
    if (dtls) {
      for (const item of dtls) {
        await tambahStok(item.idbarang, item.kategori, item.qty);
      }
    }
    await supabase.from('trs_penjualan_hdr').delete().eq('id', id);
  } catch {}

  await writeLog('DELETE', 'trs_penjualan_hdr', `Hapus penjualan ID: ${id}`);
}

export async function cancelBarangTerjual(detailId: number) {
  // 1. Jika item lokal offline (detailId < 0)
  if (detailId < 0) {
    const localSales = getOfflineSales();
    for (let sIdx = 0; sIdx < localSales.length; sIdx++) {
      const s = localSales[sIdx];
      const itIdx = (s.items || []).findIndex((_, dIdx) => -1 * (dIdx + 1) === detailId);
      if (itIdx >= 0) {
        const item = s.items[itIdx];
        await tambahStok(item.idbarang, item.kategori, item.qty);
        s.items.splice(itIdx, 1);
        if (s.items.length === 0) {
          localSales.splice(sIdx, 1);
        } else {
          s.header.total_harga = Math.max(0, (s.header.total_harga || 0) - (item.harga_jual * item.qty));
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('local_offline_sales', JSON.stringify(localSales));
        }
        return;
      }
    }
    return;
  }

  // 2. Transaksi Cloud (Neon DB)
  try {
    await callNeonApi('cancelBarangTerjual', { id: detailId }, 'POST');
  } catch {}

  // 3. Fallback Supabase
  try {
    const { data: dtl } = await supabase.from('trs_penjualan_dtl').select('*').eq('id', detailId).single();
    if (dtl) {
      const { idhdr, idbarang, kategori, qty, harga_jual, code, nama_barang } = dtl;
      await tambahStok(idbarang, kategori, qty);
      await supabase.from('trs_penjualan_dtl').delete().eq('id', detailId);
      const { data: remaining } = await supabase.from('trs_penjualan_dtl').select('id').eq('idhdr', idhdr);
      if (!remaining || remaining.length === 0) {
        await supabase.from('trs_penjualan_hdr').delete().eq('id', idhdr);
      } else {
        const { data: hdr } = await supabase.from('trs_penjualan_hdr').select('total_harga').eq('id', idhdr).single();
        const newTotal = (hdr?.total_harga || 0) - (harga_jual * qty);
        await supabase.from('trs_penjualan_hdr').update({ total_harga: newTotal, update_time: new Date().toISOString() }).eq('id', idhdr);
      }
      await writeLog('DELETE', 'trs_penjualan_dtl', `Batal terjual detail ID: ${detailId}, Barang: ${nama_barang}, Code: ${code || '-'}, Qty: ${qty}`);
    }
  } catch {}
}

export async function deleteBarangTerjual(detailId: number) {
  // 1. Jika item lokal offline (detailId < 0)
  if (detailId < 0) {
    const localSales = getOfflineSales();
    for (let sIdx = 0; sIdx < localSales.length; sIdx++) {
      const s = localSales[sIdx];
      const itIdx = (s.items || []).findIndex((_, dIdx) => -1 * (dIdx + 1) === detailId);
      if (itIdx >= 0) {
        const item = s.items[itIdx];
        s.items.splice(itIdx, 1);
        if (s.items.length === 0) {
          localSales.splice(sIdx, 1);
        } else {
          s.header.total_harga = Math.max(0, (s.header.total_harga || 0) - (item.harga_jual * item.qty));
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('local_offline_sales', JSON.stringify(localSales));
        }
        return;
      }
    }
    return;
  }

  // 2. Cloud Neon DB
  try {
    await callNeonApi('deleteBarangTerjual', { id: detailId }, 'POST');
  } catch {}

  // 3. Fallback Supabase
  try {
    const { data: dtl } = await supabase.from('trs_penjualan_dtl').select('*').eq('id', detailId).single();
    if (dtl) {
      const { idhdr, qty, harga_jual, code, nama_barang } = dtl;
      await supabase.from('trs_penjualan_dtl').delete().eq('id', detailId);
      const { data: remaining } = await supabase.from('trs_penjualan_dtl').select('id').eq('idhdr', idhdr);
      if (!remaining || remaining.length === 0) {
        await supabase.from('trs_penjualan_hdr').delete().eq('id', idhdr);
      } else {
        const { data: hdr } = await supabase.from('trs_penjualan_hdr').select('total_harga').eq('id', idhdr).single();
        const newTotal = (hdr?.total_harga || 0) - (harga_jual * qty);
        await supabase.from('trs_penjualan_hdr').update({ total_harga: newTotal, update_time: new Date().toISOString() }).eq('id', idhdr);
      }
      await writeLog('DELETE', 'trs_penjualan_dtl', `Hapus permanen barang terjual ID: ${detailId}, Barang: ${nama_barang}, Code: ${code || '-'}, Qty: ${qty}`);
    }
  } catch {}
}

export async function updatePenjualanHeader(id: number, payload: Partial<TrsPenjualanHdr>) {
  if (id < 0) {
    const localSales = getOfflineSales();
    const target = localSales.find((_, idx) => -1 * (idx + 1) === id);
    if (target) {
      target.header = { ...target.header, ...payload };
      if (typeof window !== 'undefined') {
        localStorage.setItem('local_offline_sales', JSON.stringify(localSales));
      }
      return { ...target.header, id } as TrsPenjualanHdr;
    }
    return { ...payload, id } as TrsPenjualanHdr;
  }

  const neonRes = await callNeonApi('updatePenjualanHeader', { id, ...payload }, 'POST');
  if (neonRes) return neonRes as TrsPenjualanHdr;

  try {
    const { data } = await supabase
      .from('trs_penjualan_hdr')
      .update({ ...payload, update_time: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (data) return data as TrsPenjualanHdr;
  } catch {}

  await writeLog('UPDATE', 'trs_penjualan_hdr', `Ubah info penjualan ID: ${id} (${payload.customer || 'Umum'})`);
  return { ...payload, id } as TrsPenjualanHdr;
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
  } else {
    // ms_barang (Kelontong & Baju)
    try {
      const { data } = await supabase.from('ms_barang').select('qty').eq('id', idbarang).single();
      if (data) {
        await supabase.from('ms_barang').update({ qty: (data.qty || 0) + qty, update_time: new Date().toISOString() }).eq('id', idbarang);
      }
    } catch {
      // ignore
    }
    const locals = getLocalBarangs();
    const idx = locals.findIndex(b => b.id === idbarang);
    if (idx >= 0) {
      locals[idx].qty += qty;
      saveLocalBarangs(locals);
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
  // 1. Coba ambil dari Neon DB via /api/neon
  try {
    const neonRes = await callNeonApi('getDashboardStats', from || to ? { from: from || '', to: to || '' } : undefined);
    if (neonRes && typeof neonRes.total_pemasukan === 'number') {
      const barangs = await getBarangs();
      const total_produk = barangs.reduce((sum, b) => sum + (b.qty || 0), 0);
      const total_aset = barangs.reduce((sum, b) => sum + (b.harga_modal || 0) * (b.qty || 0), 0);
      return {
        ...neonRes,
        total_produk: neonRes.total_produk || total_produk,
        total_aset: neonRes.total_aset || total_aset,
      };
    }
  } catch {}

  // 2. Fallback hitung dari data lokal / penjualan offline dan barangs
  const sales = await getPenjualan(from, to);
  let total_pemasukan = 0;
  let total_pengeluaran = 0;
  for (const s of sales) {
    const items = s.details || (s as any).trs_penjualan_dtl || [];
    for (const it of items) {
      total_pemasukan += (it.harga_jual || 0) * (it.qty || 1);
      total_pengeluaran += (it.harga_modal || 0) * (it.qty || 1);
    }
  }

  const barangs = await getBarangs();
  const total_produk = barangs.reduce((sum, b) => sum + (b.qty || 0), 0);
  const total_aset = barangs.reduce((sum, b) => sum + (b.harga_modal || 0) * (b.qty || 0), 0);

  return {
    total_pemasukan,
    total_pengeluaran,
    total_keuntungan: total_pemasukan - total_pengeluaran,
    total_produk,
    total_aset,
  };
}

export async function getChartData(from?: string, to?: string): Promise<ChartDataPoint[]> {
  try {
    const sales = await getPenjualan(from, to);
    const grouped: Record<string, ChartDataPoint> = {};

    for (const s of sales) {
      const date = (s.tanggal_penjualan || s.create_time || '').substring(0, 10);
      if (!date) continue;
      if (!grouped[date]) {
        grouped[date] = { tanggal: date, pemasukan: 0, pengeluaran: 0, keuntungan: 0 };
      }
      const items = s.details || (s as any).trs_penjualan_dtl || [];
      for (const it of items) {
        const itemPem = (it.harga_jual || 0) * (it.qty || 1);
        const itemPeng = (it.harga_modal || 0) * (it.qty || 1);
        grouped[date].pemasukan += itemPem;
        grouped[date].pengeluaran += itemPeng;
        grouped[date].keuntungan += (itemPem - itemPeng);
      }
    }

    return Object.values(grouped).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  } catch {
    return [];
  }
}

export async function getKategoriSales(from?: string, to?: string): Promise<KategoriSales[]> {
  try {
    const sales = await getPenjualan(from, to);
    const grouped: Record<string, KategoriSales> = {};

    for (const s of sales) {
      const items = s.details || (s as any).trs_penjualan_dtl || [];
      for (const it of items) {
        const kat = (it.kategori as string) || 'Umum';
        if (!grouped[kat]) grouped[kat] = { kategori: kat, jumlah: 0, total: 0 };
        grouped[kat].jumlah += (it.qty || 1);
        grouped[kat].total += (it.harga_jual || 0) * (it.qty || 1);
      }
    }

    return Object.values(grouped);
  } catch {
    return [];
  }
}

// ============================================
// SEARCH FOR POS (barcode scan)
// ============================================

export async function searchBarcode(barcode: string) {
  // Search in ms_barang (Kelontong & Baju)
  try {
    const { data: brg } = await supabase
      .from('ms_barang')
      .select('*')
      .eq('barcode', barcode)
      .gt('qty', 0)
      .single();
    if (brg) {
      return {
        idbarang: brg.id,
        kategori: brg.kategori,
        code: brg.barcode,
        nama_barang: `${brg.merk ? brg.merk + ' ' : ''}${brg.nama}${brg.ukuran ? ` (${brg.ukuran})` : ''}`,
        qty: 1,
        harga_modal: brg.harga_modal,
        harga_jual: brg.harga_jual,
        supplier: brg.supplier,
        max_qty: brg.qty,
      };
    }
  } catch {
    // fallback
  }

  const localBrg = getLocalBarangs().find(b => b.barcode.toLowerCase() === barcode.toLowerCase() && b.qty > 0);
  if (localBrg) {
    return {
      idbarang: localBrg.id,
      kategori: localBrg.kategori,
      code: localBrg.barcode,
      nama_barang: `${localBrg.merk ? localBrg.merk + ' ' : ''}${localBrg.nama}${localBrg.ukuran ? ` (${localBrg.ukuran})` : ''}`,
      qty: 1,
      harga_modal: localBrg.harga_modal,
      harga_jual: localBrg.harga_jual,
      supplier: localBrg.supplier,
      max_qty: localBrg.qty,
    };
  }

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

  // 0. ms_barang (Kelontong & Baju)
  try {
    const { data: brgs } = await supabase
      .from('ms_barang')
      .select('*')
      .or(`nama.ilike.${q},merk.ilike.${q},barcode.ilike.${q}`)
      .gt('qty', 0)
      .limit(10);
    if (brgs) {
      brgs.forEach(b => {
        results.push({
          idbarang: b.id,
          kategori: b.kategori,
          code: b.barcode,
          nama_barang: `${b.merk ? b.merk + ' ' : ''}${b.nama}${b.ukuran ? ` (${b.ukuran})` : ''}`,
          qty: 1,
          harga_modal: b.harga_modal,
          harga_jual: b.harga_jual,
          supplier: b.supplier,
          max_qty: b.qty,
        });
      });
    }
  } catch {
    // fallback
  }

  const queryLower = query.toLowerCase();
  const localMatched = getLocalBarangs().filter(
    b => b.qty > 0 &&
      (b.nama.toLowerCase().includes(queryLower) ||
       (b.merk && b.merk.toLowerCase().includes(queryLower)) ||
       b.barcode.toLowerCase().includes(queryLower))
  );
  localMatched.forEach(b => {
    if (!results.some(r => r.code === b.barcode)) {
      results.push({
        idbarang: b.id,
        kategori: b.kategori,
        code: b.barcode,
        nama_barang: `${b.merk ? b.merk + ' ' : ''}${b.nama}${b.ukuran ? ` (${b.ukuran})` : ''}`,
        qty: 1,
        harga_modal: b.harga_modal,
        harga_jual: b.harga_jual,
        supplier: b.supplier,
        max_qty: b.qty,
      });
    }
  });

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


