'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthUser, MsKategori } from '@/lib/types';
import { canAccess } from '@/lib/auth';
import { getKategoris } from '@/lib/db';

interface SidebarProps {
  user: AuthUser;
  collapsed: boolean;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface NavGroup {
  label: string;
  icon: string;
  feature: string;
  items: { label: string; href: string }[];
}

interface NavSingle {
  label: string;
  href: string;
  icon: string;
  feature: string;
}

const NAV_SINGLES: NavSingle[] = [
  { label: 'Dashboard', href: '/dashboard', icon: '🏠', feature: 'dashboard' },
];

export default function Sidebar({ user, collapsed, mobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const [categories, setCategories] = useState<MsKategori[]>([]);
  const [currentSearch, setCurrentSearch] = useState('');

  const refreshCategories = useCallback(async () => {
    try {
      const list = await getKategoris();
      setCategories(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshCategories();
    if (typeof window !== 'undefined') {
      setCurrentSearch(window.location.search || '');
    }

    const handleUpdate = () => {
      refreshCategories();
      if (typeof window !== 'undefined') {
        setCurrentSearch(window.location.search || '');
      }
    };

    window.addEventListener('kategori_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('popstate', handleUpdate);

    return () => {
      window.removeEventListener('kategori_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('popstate', handleUpdate);
    };
  }, [refreshCategories, pathname]);

  const navGroups: NavGroup[] = useMemo(() => {
    // Dynamic Stock items derived directly from Master Kategori Stock
    const dynamicStockItems: { label: string; href: string }[] = [
      { label: '📦 Semua Stock', href: '/stock' },
    ];

    categories.forEach(k => {
      const icon = k.jenis_toko === 'kelontong' ? '🏪 ' : k.jenis_toko === 'baju' ? '👕 ' : '🏷️ ';
      dynamicStockItems.push({
        label: `${icon}${k.nama}`,
        href: `/stock?kategori=${encodeURIComponent(k.nama)}`,
      });
    });

    return [
      {
        label: 'Master',
        icon: '📂',
        feature: 'master',
        items: [
          { label: 'Kategori Stock', href: '/master/kategori' },
          { label: 'Merk', href: '/master/merk' },
          { label: 'Operator', href: '/master/operator' },
          { label: 'Supplier', href: '/master/supplier' },
        ],
      },
      {
        label: 'Stock',
        icon: '📦',
        feature: 'stock',
        items: dynamicStockItems,
      },
      {
        label: 'Transaksi',
        icon: '🛒',
        feature: 'transaksi',
        items: [
          { label: 'Pembelian', href: '/transaksi/pembelian' },
          { label: 'Kasir', href: '/transaksi/penjualan' },
          { label: 'Detail Penjualan', href: '/transaksi/detail-penjualan' },
          { label: 'Barang Terjual', href: '/transaksi/barang-terjual' },
          { label: 'Garansi', href: '/transaksi/garansi' },
        ],
      },
      {
        label: 'Pengaturan',
        icon: '⚙️',
        feature: 'pengaturan',
        items: [
          { label: 'Printer', href: '/pengaturan/printer' },
          { label: 'Pengguna', href: '/pengaturan/pengguna' },
          { label: 'Log Aktivitas', href: '/pengaturan/log-aktivitas' },
          { label: 'Log Barang', href: '/pengaturan/log-barang' },
        ],
      },
    ];
  }, [categories]);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    return {
      Master: pathname?.startsWith('/master') ?? false,
      Stock: pathname?.startsWith('/stock') ?? false,
      Transaksi: pathname?.startsWith('/transaksi') ?? false,
      Pengaturan: pathname?.startsWith('/pengaturan') ?? false,
    };
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isItemActive = (href: string) => {
    if (href.includes('?')) {
      const targetQuery = href.split('?')[1];
      const targetPath = href.split('?')[0];
      return pathname === targetPath && currentSearch.includes(targetQuery);
    }
    if (href === '/stock') {
      return pathname === '/stock' && (!currentSearch || currentSearch === '' || currentSearch === '?kategori=semua');
    }
    return pathname === href;
  };

  return (
    <aside className={`app-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" style={{ background: 'none' }}>
          <img src="/logo-series.webp" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <span className="sidebar-logo-text">Kasir Pintar</span>
        {/* Mobile close button */}
        <button className="sidebar-close-mobile" onClick={onCloseMobile} title="Tutup Menu">
          ✕
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {(!collapsed || mobileOpen) && <div className="sidebar-section-title">Menu</div>}

        {/* Single items */}
        {NAV_SINGLES.filter(item => canAccess(user.role, item.feature)).map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-single-item${pathname === item.href ? ' active' : ''}`}
            onClick={onCloseMobile}
          >
            <span className="icon" style={{ fontSize: 16 }}>{item.icon}</span>
            <span className="sidebar-item-label">{item.label}</span>
          </Link>
        ))}

        {/* Groups */}
        {navGroups.filter(g => canAccess(user.role, g.feature)).map(group => (
          <div key={group.label} className="sidebar-group">
            <div
              className={`sidebar-group-header${group.items.some(i => pathname?.startsWith(i.href.split('?')[0])) ? ' active' : ''}`}
              onClick={() => (collapsed && !mobileOpen) ? null : toggleGroup(group.label)}
              title={collapsed && !mobileOpen ? group.label : undefined}
            >
              <span className="icon" style={{ fontSize: 16 }}>{group.icon}</span>
              <span className="sidebar-group-label">{group.label}</span>
              {(!collapsed || mobileOpen) && (
                <svg
                  className={`sidebar-chevron${openGroups[group.label] ? ' open' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              )}
            </div>

            {(!collapsed || mobileOpen) && (
              <div className={`sidebar-group-items${openGroups[group.label] ? ' open' : ''}`}>
                {group.items
                  .filter(item => {
                    if (item.href === '/transaksi/barang-terjual') {
                      return user?.role === 'super_admin';
                    }
                    if (user?.role === 'kasir' && item.href === '/transaksi/pembelian') {
                      return false;
                    }
                    if (item.href === '/pengaturan/pengguna' || item.href === '/pengaturan/log-aktivitas' || item.href === '/pengaturan/log-barang') {
                      return user?.role === 'super_admin';
                    }
                    if (item.href === '/pengaturan/printer') {
                      return user?.role === 'super_admin' || user?.role === 'kasir';
                    }
                    return true;
                  })
                  .map(item => {
                    const active = isItemActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-item${active ? ' active' : ''}`}
                        onClick={() => {
                          if (item.href.includes('?')) {
                            setCurrentSearch(`?${item.href.split('?')[1]}`);
                          } else {
                            setCurrentSearch('');
                          }
                          onCloseMobile?.();
                        }}
                      >
                        <span className="sidebar-item-label">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}
