'use client';

import { useState, useEffect } from 'react';

// Custom event to trigger PWA installation from anywhere (e.g. Header, Settings)
export const TRIGGER_PWA_INSTALL = 'trigger_pwa_install';

export function promptPwaInstall() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TRIGGER_PWA_INSTALL));
  }
}

export default function PwaManager() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if already running standalone (installed PWA)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };
    checkStandalone();

    // Check if dismissed previously in session
    if (sessionStorage.getItem('pwa_prompt_dismissed') === 'true') {
      setIsDismissed(true);
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered successfully:', registration.scope);
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      });
    }

    // Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Dispatch global event so Header can show the Install button
      window.dispatchEvent(new CustomEvent('pwa_can_install', { detail: { canInstall: true } }));
      // Show subtle banner after 3 seconds if not dismissed and not standalone
      setTimeout(() => {
        if (!isStandalone && sessionStorage.getItem('pwa_prompt_dismissed') !== 'true') {
          setShowToast(true);
        }
      }, 3000);
    };

    // Listen when app is installed
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowToast(false);
      window.dispatchEvent(new CustomEvent('pwa_can_install', { detail: { canInstall: false } }));
    };

    // Listen to manual install trigger from Header or buttons
    const handleManualInstallTrigger = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[PWA] User accepted the install prompt');
        } else {
          console.log('[PWA] User dismissed the install prompt');
        }
        setDeferredPrompt(null);
        setShowToast(false);
      } else {
        alert(
          'Untuk menginstal di komputer:\n' +
            'Klik tombol titik tiga (⋮) di pojok kanan atas browser Chrome/Edge, lalu pilih "Install Kenzo POS" atau "Simpan dan bagikan > Pasang halaman ini sebagai aplikasi".'
        );
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener(TRIGGER_PWA_INSTALL, handleManualInstallTrigger);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener(TRIGGER_PWA_INSTALL, handleManualInstallTrigger);
    };
  }, [isStandalone]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      alert(
        'Untuk menginstal:\n' +
          'Klik icon Install di address bar browser Anda (atau menu titik tiga ⋮ > Install Kenzo POS).'
      );
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowToast(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowToast(false);
    setIsDismissed(true);
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  if (isStandalone || !showToast || isDismissed) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99999,
        background: '#1e293b',
        color: '#f8fafc',
        borderRadius: 12,
        padding: '14px 18px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        border: '1px solid #3b82f6',
        maxWidth: 360,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: '#2563eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 22,
        }}
      >
        📲
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#ffffff' }}>Install Aplikasi Kasir Kenzo</div>
        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
          Buka langsung dari Desktop / HP tanpa buka browser, bekerja 100% offline!
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={handleInstallClick}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Install Sekarang
          </button>
          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              border: '1px solid #475569',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}
