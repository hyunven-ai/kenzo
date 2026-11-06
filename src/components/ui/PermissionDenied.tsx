'use client';

import React from 'react';
import { AuthUser } from '@/lib/types';
import { getRoleLabel } from '@/lib/auth';

interface PermissionDeniedProps {
  user: AuthUser;
  requiredRole?: string;
  currentPath?: string;
  onGoBack?: () => void;
  onSwitchAccount?: () => void;
}

export default function PermissionDenied({
  user,
  requiredRole = 'Super Admin',
  currentPath = '',
  onGoBack,
  onSwitchAccount,
}: PermissionDeniedProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '65vh',
        padding: '32px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-light)',
          borderRadius: '12px',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '32px',
            marginBottom: '18px',
          }}
        >
          🔒
        </div>

        <h2
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text-primary)',
            marginBottom: '8px',
            letterSpacing: '-0.02em',
          }}
        >
          Akses Dibatasi
        </h2>

        {/* Explain why you need it */}
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            marginBottom: '20px',
          }}
        >
          Halaman <code style={{ fontSize: '13px' }}>{currentPath || 'ini'}</code> memerlukan hak akses{' '}
          <strong style={{ color: '#dc2626' }}>{requiredRole}</strong> untuk melindungi data sensitif dan pengaturan toko.
        </p>

        {/* Current user badge */}
        <div
          style={{
            background: 'var(--bg-main)',
            border: '1px solid var(--border-light)',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '24px',
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--text-secondary)' }}>Login sebagai:</span>
          <span>
            <strong>@{user.username}</strong> ({getRoleLabel(user.role)})
          </span>
        </div>

        {/* Give a clear way back */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {onGoBack && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onGoBack}
              style={{ fontWeight: 600, fontSize: '13.5px', padding: '9px 20px' }}
            >
              ← Kembali ke Menu Utama
            </button>
          )}

          {onSwitchAccount && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSwitchAccount}
              style={{ fontSize: '13.5px', padding: '9px 16px' }}
            >
              Ganti Akun
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
