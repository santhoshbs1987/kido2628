import { useEffect } from 'react';
import { useUiStore } from '../stores/uiStore';

export function useKeyboardShortcuts(): void {
  const setActivePage = useUiStore((state) => state.setActivePage);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts if user is holding Ctrl/Cmd/Alt unless intended
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setActivePage('pos');
          break;
        case 'F2':
          e.preventDefault();
          setActivePage('products');
          break;
        case 'F3':
          e.preventDefault();
          setActivePage('reports');
          break;
        case 'F4':
          e.preventDefault();
          setActivePage('purchases');
          break;
        case 'F5':
          e.preventDefault();
          setActivePage('returns');
          break;
        case 'F6':
          e.preventDefault();
          setActivePage('shifts');
          break;
        case 'F7':
          e.preventDefault();
          setActivePage('settings');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActivePage]);
}
