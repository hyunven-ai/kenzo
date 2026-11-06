'use client';

import React from 'react';

export interface FormFieldProps {
  label?: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  hint?: string | null;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * FormField Component
 * State 9: Form validation -> Flag the exact field, inline, with how to fix it.
 */
export default function FormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  rightAction,
  children,
  className = 'form-group',
  style,
}: FormFieldProps) {
  return (
    <div className={className} style={{ marginBottom: 14, ...style }}>
      {(label || rightAction) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          {label && (
            <label
              htmlFor={htmlFor}
              className="form-label"
              style={{
                marginBottom: 0,
                fontSize: '13px',
                fontWeight: 600,
                color: error ? '#ef4444' : 'var(--text-secondary)',
              }}
            >
              {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}
          {rightAction && <div>{rightAction}</div>}
        </div>
      )}

      {children}

      {/* State 9: Inline validation flagging what is wrong and how to fix it */}
      {error ? (
        <div
          role="alert"
          style={{
            marginTop: 6,
            fontSize: '12px',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            lineHeight: 1.35,
            fontWeight: 500,
            background: 'rgba(239, 68, 68, 0.08)',
            borderLeft: '3px solid #ef4444',
            padding: '4px 8px',
            borderRadius: '0 4px 4px 0',
          }}
        >
          <span style={{ flexShrink: 0, fontSize: '13px' }}>⚠️</span>
          <span>{error}</span>
        </div>
      ) : hint ? (
        <div
          style={{
            marginTop: 4,
            fontSize: '11px',
            color: 'var(--text-muted, #888)',
            lineHeight: 1.3,
          }}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
