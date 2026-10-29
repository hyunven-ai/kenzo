'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'CODE39' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  margin?: number;
  background?: string;
  lineColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function BarcodeGenerator({
  value,
  format = 'CODE128',
  width = 1.4,
  height = 36,
  displayValue = false,
  fontSize = 11,
  margin = 0,
  background = 'transparent',
  lineColor = '#000000',
  className = '',
  style = {},
}: BarcodeGeneratorProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value || !value.trim()) return;

    const renderBarcode = (chosenFormat: string) => {
      try {
        JsBarcode(svgRef.current, value.trim(), {
          format: chosenFormat,
          width,
          height,
          displayValue,
          fontSize,
          margin,
          background,
          lineColor,
          font: 'Outfit, Inter, sans-serif',
          textMargin: 1,
        });
        return true;
      } catch (err) {
        return false;
      }
    };

    // Try selected format first, fallback to CODE128 if error (e.g. non-numeric in EAN13)
    const success = renderBarcode(format);
    if (!success && format !== 'CODE128') {
      renderBarcode('CODE128');
    }
  }, [value, format, width, height, displayValue, fontSize, margin, background, lineColor]);

  if (!value || !value.trim()) {
    return <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>Tanpa Barcode</div>;
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      style={{
        display: 'block',
        margin: '0 auto',
        maxWidth: '100%',
        height: 'auto',
        ...style,
      }}
    />
  );
}

