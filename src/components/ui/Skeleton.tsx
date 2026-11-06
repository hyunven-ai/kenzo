'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

/**
 * Base Skeleton block with fluid shimmer effect
 */
export function Skeleton({
  className = '',
  width,
  height,
  borderRadius,
  style = {},
}: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width: width !== undefined ? width : '100%',
        height: height !== undefined ? height : '16px',
        borderRadius: borderRadius !== undefined ? borderRadius : '4px',
        display: 'inline-block',
        ...style,
      }}
    />
  );
}

/**
 * Skeleton table rows to preview tabular data before it loads
 */
interface SkeletonTableProps {
  columns: number | Array<{ width?: string; label?: string }>;
  rows?: number;
  hasCheckbox?: boolean;
  hasActions?: boolean;
}

export function SkeletonTable({
  columns,
  rows = 5,
  hasCheckbox = false,
  hasActions = true,
}: SkeletonTableProps) {
  const colCount = typeof columns === 'number' ? columns : columns.length;
  const colWidths = typeof columns === 'number' ? [] : columns.map(c => c.width);

  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="skeleton-row" style={{ animationDelay: `${rIdx * 0.08}s` }}>
          {hasCheckbox && (
            <td style={{ width: '40px', padding: '12px 14px' }}>
              <Skeleton width="18px" height="18px" borderRadius="4px" />
            </td>
          )}
          {/* Index column */}
          <td style={{ width: '50px', padding: '12px 14px' }}>
            <Skeleton width="20px" height="14px" />
          </td>
          {/* Content columns with realistic proportional widths */}
          {Array.from({ length: colCount }).map((_, cIdx) => {
            const width = colWidths[cIdx] || (cIdx === 0 ? '75%' : cIdx === 1 ? '60%' : '50%');
            return (
              <td key={cIdx} style={{ padding: '12px 14px' }}>
                <Skeleton width={width} height="15px" />
              </td>
            );
          })}
          {hasActions && (
            <td style={{ width: '120px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <Skeleton width="55px" height="28px" borderRadius="4px" />
                <Skeleton width="30px" height="28px" borderRadius="4px" />
              </div>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

/**
 * Skeleton metrics card (for Dashboard summary cards)
 */
export function SkeletonMetricCard() {
  return (
    <div
      className="metric-card"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-light)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <Skeleton width="45%" height="13px" />
      <Skeleton width="70%" height="28px" borderRadius="6px" />
      <Skeleton width="35%" height="11px" />
    </div>
  );
}

/**
 * Skeleton block for product cards or list items
 */
export function SkeletonCard() {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '8px',
        border: '1px solid var(--border-light)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <Skeleton width="100%" height="120px" borderRadius="6px" />
      <Skeleton width="80%" height="16px" />
      <Skeleton width="45%" height="14px" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
        <Skeleton width="35%" height="18px" />
        <Skeleton width="60px" height="32px" borderRadius="6px" />
      </div>
    </div>
  );
}

