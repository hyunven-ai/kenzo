'use client';

import React from 'react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  cause?: string;
  solution?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onFallback?: () => void;
  fallbackLabel?: string;
  compact?: boolean;
}

export default function ErrorState({
  title = 'Terjadi Kendala',
  message,
  cause,
  solution,
  onRetry,
  retryLabel = 'Coba Lagi',
  onFallback,
  fallbackLabel = 'Gunakan Data Lokal',
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className="error-state-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: compact ? '20px 16px' : '36px 24px',
        maxWidth: '520px',
        margin: '0 auto',
        background: 'var(--bg-card)',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          width: compact ? '40px' : '52px',
          height: compact ? '40px' : '52px',
          borderRadius: '50%',
          background: '#fee2e2',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: compact ? '20px' : '26px',
          marginBottom: '12px',
        }}
      >
        ⚠️
      </div>

      <h4
        style={{
          fontSize: compact ? '15px' : '17px',
          fontWeight: 700,
          color: '#b91c1c',
          marginBottom: '6px',
        }}
      >
        {title}
      </h4>

      {/* 1. What went wrong */}
      <p
        style={{
          fontSize: compact ? '12.5px' : '13.5px',
          color: 'var(--text-primary)',
          fontWeight: 600,
          marginBottom: '8px',
        }}
      >
        {message}
      </p>

      {/* 2. Whose fault / Root cause */}
      {cause && (
        <div
          style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            background: 'var(--bg-main)',
            padding: '6px 12px',
            borderRadius: '6px',
            marginBottom: '8px',
            width: '100%',
          }}
        >
          <strong>Penyebab:</strong> {cause}
        </div>
      )}

      {/* 3. How to fix it */}
      {solution && (
        <p
          style={{
            fontSize: '12px',
            color: '#15803d',
            marginBottom: '16px',
            fontWeight: 500,
          }}
        >
          💡 <strong>Solusi:</strong> {solution}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {onRetry && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onRetry}
            style={{ fontWeight: 600, fontSize: '13px' }}
          >
            🔄 {retryLabel}
          </button>
        )}
        {onFallback && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onFallback}
            style={{ fontSize: '13px' }}
          >
            📂 {fallbackLabel}
          </button>
        )}
      </div>
    </div>
  );
}

