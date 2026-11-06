'use client';

import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className="empty-state-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: compact ? '24px 16px' : '48px 20px',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        className="empty-state-icon"
        style={{
          fontSize: compact ? '32px' : '48px',
          marginBottom: compact ? '8px' : '16px',
          lineHeight: 1,
          opacity: 0.85,
        }}
      >
        {icon || '📦'}
      </div>

      <h3
        style={{
          fontSize: compact ? '15px' : '17px',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '6px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      <p
        style={{
          fontSize: compact ? '12px' : '13.5px',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
          marginBottom: actionLabel ? (compact ? '16px' : '20px') : 0,
        }}
      >
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {actionLabel && onAction && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onAction}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '13px',
              }}
            >
              <span>+</span>
              <span>{actionLabel}</span>
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onSecondaryAction}
              style={{ fontSize: '13px' }}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
