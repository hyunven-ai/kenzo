'use client';

import React from 'react';

export type DatePresetKey =
  | 'kemarin'
  | 'hari_ini'
  | '1_minggu'
  | '1_bulan'
  | '3_bulan'
  | '1_tahun';

export interface DatePresetItem {
  key: DatePresetKey;
  label: string;
  shortLabel?: string;
}

export const DATE_PRESETS: DatePresetItem[] = [
  { key: 'kemarin', label: 'Kemarin' },
  { key: 'hari_ini', label: 'Hari Ini' },
  { key: '1_minggu', label: '1 Minggu' },
  { key: '1_bulan', label: '1 Bulan' },
  { key: '3_bulan', label: '3 Bulan' },
  { key: '1_tahun', label: '1 Tahun' },
];

/**
 * Helper to get local date formatted as YYYY-MM-DD
 */
export function getLocalISODate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Calculates start and end dates for a preset
 */
export function computePresetRange(preset: DatePresetKey): { from: string; to: string } {
  const now = new Date();
  const todayStr = getLocalISODate(now);

  switch (preset) {
    case 'kemarin': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = getLocalISODate(yesterday);
      return { from: yStr, to: yStr };
    }
    case 'hari_ini': {
      return { from: todayStr, to: todayStr };
    }
    case '1_minggu': {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      return { from: getLocalISODate(past), to: todayStr };
    }
    case '1_bulan': {
      const past = new Date(now);
      past.setMonth(past.getMonth() - 1);
      return { from: getLocalISODate(past), to: todayStr };
    }
    case '3_bulan': {
      const past = new Date(now);
      past.setMonth(past.getMonth() - 3);
      return { from: getLocalISODate(past), to: todayStr };
    }
    case '1_tahun': {
      const past = new Date(now);
      past.setFullYear(past.getFullYear() - 1);
      return { from: getLocalISODate(past), to: todayStr };
    }
  }
}

interface DateRangeToggleProps {
  currentFrom: string;
  currentTo: string;
  onSelect: (from: string, to: string, preset: DatePresetKey) => void;
  className?: string;
  style?: React.CSSProperties;
}

export default function DateRangeToggle({
  currentFrom,
  currentTo,
  onSelect,
  className = '',
  style,
}: DateRangeToggleProps) {
  // Find which preset currently matches the range (if any)
  const activePreset = DATE_PRESETS.find(p => {
    const range = computePresetRange(p.key);
    return range.from === currentFrom && range.to === currentTo;
  })?.key;

  return (
    <div
      className={`date-range-toggle-group ${className}`}
      role="group"
      aria-label="Filter Rentang Tanggal Cepat"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '4px',
        background: 'var(--bg-main, #18181b)',
        border: '1px solid var(--border-light, #2e2e36)',
        borderRadius: '10px',
        padding: '3px 4px',
        ...style,
      }}
    >
      {DATE_PRESETS.map(preset => {
        const isActive = activePreset === preset.key;
        return (
          <button
            key={preset.key}
            type="button"
            className={`date-preset-pill ${isActive ? 'active' : ''}`}
            onClick={() => {
              const range = computePresetRange(preset.key);
              onSelect(range.from, range.to, preset.key);
            }}
            id={`preset-${preset.key}`}
            title={`Langsung filter: ${preset.label}`}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#ffffff' : 'var(--text-secondary, #a1a1aa)',
              background: isActive ? 'var(--brand-primary, #ef4444)' : 'transparent',
              border: 'none',
              borderRadius: '7px',
              cursor: 'pointer',
              transition: 'all 0.15s ease-in-out',
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 2px 6px rgba(239, 68, 68, 0.35)' : 'none',
              lineHeight: 1.2,
            }}
            onMouseEnter={e => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-secondary, #a1a1aa)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {preset.label}
          </button>
        );
      })}
    </div>
  );
}
