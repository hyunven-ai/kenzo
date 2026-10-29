'use client';

import { useState, useEffect } from 'react';
import { AuthUser } from '@/lib/types';
import { getRoleLabel } from '@/lib/auth';
import { getOfflineSales, syncPendingSalesToNeon } from '@/lib/db';

interface HeaderProps {
  user: AuthUser;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
}

export default function Header({ user, isDarkMode, onToggleDarkMode, onToggleSidebar, onLogout }: HeaderProps) {
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      setOnline(navigator.onLine);
      const pending = getOfflineSales().filter(s => !s.synced).length;
      setPendingCount(pending);
    };

    checkStatus();
    window.addEventListener('online', checkStatus);
    window.addEventListener('offline', checkStatus);
    const interval = setInterval(checkStatus, 4000);

    return () => {
      window.removeEventListener('online', checkStatus);
      window.removeEventListener('offline', checkStatus);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncPendingSalesToNeon();
      const pending = getOfflineSales().filter(s => !s.synced).length;
      setPendingCount(pending);
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="header-toggle" onClick={onToggleSidebar} title="Toggle Sidebar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="header-title">Kasir Pintar</span>
      </div>

      <div className="header-right">
        {/* Neon DB / Offline Status Badge */}
        {online ? (
          <div
            className="badge badge-success"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
            title="Database Neon Cloud Terhubung"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            <span>Neon Online</span>
          </div>
        ) : (
          <div
            className="badge badge-error"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 10px' }}
            title="Internet terputus - transaksi disimpan aman secara lokal"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            <span>Offline (Lokal)</span>
          </div>
        )}

        {/* Sync Button if there are pending offline sales */}
        {pendingCount > 0 && (
          <button
            className="btn btn-warning btn-sm"
            style={{ padding: '4px 10px', fontSize: 12, fontWeight: 600 }}
            onClick={handleManualSync}
            disabled={syncing || !online}
            title="Ada transaksi offline yang belum disinkronkan ke Neon DB"
          >
            {syncing ? 'Menyinkronkan...' : `🔄 Sync (${pendingCount})`}
          </button>
        )}

        <div className="header-user-btn">
          <div className="header-avatar">
            {user.nama_lengkap.charAt(0).toUpperCase()}
          </div>
          <span>{user.nama_lengkap}</span>
          <span style={{ fontSize: 11, opacity: 0.75 }}>({getRoleLabel(user.role)})</span>
        </div>

        <button className="header-theme-btn" onClick={onToggleDarkMode} title={isDarkMode ? "Light Mode" : "Dark Mode"}>
          {isDarkMode ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        <button className="header-logout-btn" onClick={onLogout} title="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </header>
  );
}
