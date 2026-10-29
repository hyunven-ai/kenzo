import { Role, AuthUser } from './types';
import { supabase } from './supabase';

const STORAGE_KEY = 'series_ponsel_auth';

// Demo accounts (sebelum Supabase Auth dikonfigurasi)
const DEMO_ACCOUNTS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    nama_lengkap: 'Super Admin',
    role: 'super_admin' as Role,
  },
  {
    id: 2,
    username: 'gudang',
    password: 'gudang123',
    nama_lengkap: 'Admin Gudang',
    role: 'admin_gudang' as Role,
  },
  {
    id: 3,
    username: 'kasir',
    password: 'kasir123',
    nama_lengkap: 'Kasir 1',
    role: 'kasir' as Role,
  },
];

export const DEMO_ACCOUNTS_PUBLIC = DEMO_ACCOUNTS.map(a => ({
  username: a.username,
  password: a.password,
  role: a.role,
  nama_lengkap: a.nama_lengkap,
  is_active: true,
}));

async function callNeonLogin(username: string, password: string): Promise<AuthUser | null> {
  if (typeof window === 'undefined') return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch('/api/neon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        payload: { username, password },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.ok && json.data) {
      return {
        id: Number(json.data.id),
        username: json.data.username,
        nama_lengkap: json.data.nama_lengkap,
        role: json.data.role as Role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function getStoredUsersFallback(): any[] {
  if (typeof window === 'undefined') return DEMO_ACCOUNTS;
  const stored = localStorage.getItem('series_ponsel_users');
  if (!stored) {
    const initial = DEMO_ACCOUNTS.map(a => ({ ...a, is_active: true }));
    localStorage.setItem('series_ponsel_users', JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(u => {
        const demo = DEMO_ACCOUNTS.find(d => d.username.toLowerCase() === (u.username || '').toLowerCase());
        return {
          ...u,
          password: u.password || u.password_hash || demo?.password || 'admin123',
        };
      });
    }
    return DEMO_ACCOUNTS.map(a => ({ ...a, is_active: true }));
  } catch {
    return DEMO_ACCOUNTS.map(a => ({ ...a, is_active: true }));
  }
}

function loginFallback(username: string, password: string): AuthUser | null {
  const users = getStoredUsersFallback();
  const account = users.find(
    a => a.username.toLowerCase() === username.toLowerCase() && 
         (a.password === password || a.password_hash === password) && 
         a.is_active !== false
  );
  if (!account) return null;

  const user: AuthUser = {
    id: account.id,
    username: account.username,
    nama_lengkap: account.nama_lengkap,
    role: account.role,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  return user;
}

export async function login(username: string, password: string): Promise<AuthUser | null> {
  const uname = (username || '').trim();
  const pass = (password || '').trim();

  // 1. Prioritas Utama: Autentikasi langsung ke Cloud Database Neon
  try {
    const neonUser = await callNeonLogin(uname, pass);
    if (neonUser) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(neonUser));
      }
      return neonUser;
    }
  } catch (err) {
    console.warn('Neon DB login error, mencoba fallback:', err);
  }

  // 2. Fallback offline atau local storage
  return loginFallback(uname, pass);
}

export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

// RBAC - Permission check
export const PERMISSIONS: Record<Role, string[]> = {
  super_admin: [
    'dashboard', 'master', 'stock', 'transaksi', 'pengaturan', 'laporan', 'barcode'
  ],
  admin_gudang: [
    'master', 'stock', 'barcode'
  ],
  kasir: [
    'transaksi', 'pengaturan', 'barcode'
  ],
};

export function canAccess(role: Role, feature: string): boolean {
  return PERMISSIONS[role]?.includes(feature) ?? false;
}

export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    super_admin: 'Super Admin',
    admin_gudang: 'Admin Gudang',
    kasir: 'Kasir',
  };
  return labels[role] ?? role;
}

export function getRoleBadgeClass(role: Role): string {
  const classes: Record<Role, string> = {
    super_admin: 'badge-error',
    admin_gudang: 'badge-info',
    kasir: 'badge-success',
  };
  return classes[role] ?? 'badge-gray';
}
