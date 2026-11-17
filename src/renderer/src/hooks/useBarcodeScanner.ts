import { useEffect, useRef } from 'react';

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerProps): void {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore functional keys like F1-F12, Control, Alt, Meta, Tab
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Check if user is typing slowly in a regular input field other than the scan input
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';
      const isExplicitScanInput = activeEl?.id === 'barcodeScanInput';

      // Scanners type at very high speeds: typically < 50ms per key
      const isScannerSpeed = interval < 60;

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 2) {
          e.preventDefault();
          const scanned = bufferRef.current.trim();
          bufferRef.current = '';
          clearTimeout(timeoutRef.current);
          onScan(scanned);
          return;
        }
      }

      // If user is typing in a non-scan input and interval is not fast, don't hijack
      if (isInput && !isExplicitScanInput && !isScannerSpeed) {
        bufferRef.current = '';
        return;
      }

      // If interval between keystrokes was too long, reset buffer
      if (interval > 100) {
        bufferRef.current = '';
      }

      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Reset timeout for scanners that don't emit an Enter key suffix!
        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          if (bufferRef.current.length >= 4) {
            const scanned = bufferRef.current.trim();
            bufferRef.current = '';
            onScan(scanned);
          } else {
            bufferRef.current = '';
          }
        }, 75);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      clearTimeout(timeoutRef.current);
    };
  }, [onScan, enabled]);
}
