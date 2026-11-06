'use client';

import React, { useState, useEffect } from 'react';

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [dismissedSlow, setDismissedSlow] = useState(false);

  useEffect(() => {
    // 1. Initial check
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    // 2. Listen to online / offline events
    const handleOnline = () => {
      setIsOnline(true);
      setIsSlow(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. Network speed / RTT latency detector (State 5: Slow Network)
    const checkSpeed = () => {
      if (typeof navigator !== 'undefined' && (navigator as any).connection) {
        const conn = (navigator as any).connection;
        // If effectiveType is 2g or rtt > 1500ms
        if (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.rtt > 1800) {
          setIsSlow(true);
        } else {
          setIsSlow(false);
        }
      }
    };

    checkSpeed();
    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      (navigator as any).connection.addEventListener('change', checkSpeed);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (typeof navigator !== 'undefined' && (navigator as any).connection) {
        (navigator as any).connection.removeEventListener('change', checkSpeed);
      }
    };
  }, []);

  // State 4: No Internet Banner (reassuring, says what still works)
  if (!isOnline) {
    return (
      <div
        className="network-banner offline-banner"
        style={{
          background: '#d97706',
          color: '#ffffff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 9999,
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📡</span>
          <span>
            <strong>Mode Offline Aktif:</strong> Koneksi internet terputus. Data produk dari cache lokal tetap tampil. Anda tetap dapat melakukan transaksi kasir dan cetak struk POS-58.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', background: 'rgba(0,0,0,0.15)', padding: '4px 10px', borderRadius: '4px' }}>
          <span>Sinkronisasi otomatis saat online</span>
        </div>
      </div>
    );
  }

  // State 5: Slow Network Banner (shows real progress and offers a lighter path)
  if (isSlow && !dismissedSlow) {
    return (
      <div
        className="network-banner slow-network-banner"
        style={{
          background: '#0284c7',
          color: '#ffffff',
          padding: '9px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          fontSize: '13px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 9999,
          position: 'sticky',
          top: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span>
            <strong>Koneksi Internet Lambat Terdeteksi:</strong> Aplikasi tetap responsif menggunakan cache lokal di perangkat Anda.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setDismissedSlow(true)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: '#ffffff',
              padding: '3px 10px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return null;
}

