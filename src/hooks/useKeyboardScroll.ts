// Custom hook for keyboard scrolling with arrow keys
import { useEffect, useCallback, useRef } from 'react';

interface UseKeyboardScrollOptions {
  scrollAmount?: number; // Pixels to scroll per keypress
  enabled?: boolean;
  smoothScroll?: boolean;
}

export function useKeyboardScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseKeyboardScrollOptions = {}
) {
  const {
    scrollAmount = 100,
    enabled = true,
    smoothScroll = true,
  } = options;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !containerRef.current) return;

      // Ignore if user is typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      const container = containerRef.current;
      const scrollOptions: ScrollToOptions = {
        top: container.scrollTop,
        left: container.scrollLeft,
        behavior: smoothScroll ? 'smooth' : 'auto',
      };

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          scrollOptions.top = container.scrollTop + scrollAmount;
          container.scrollTo(scrollOptions);
          break;

        case 'ArrowUp':
          e.preventDefault();
          scrollOptions.top = container.scrollTop - scrollAmount;
          container.scrollTo(scrollOptions);
          break;

        case 'ArrowRight':
          // Only handle horizontal scroll if container has horizontal overflow
          if (container.scrollWidth > container.clientWidth) {
            e.preventDefault();
            scrollOptions.left = container.scrollLeft + scrollAmount;
            container.scrollTo(scrollOptions);
          }
          break;

        case 'ArrowLeft':
          // Only handle horizontal scroll if container has horizontal overflow
          if (container.scrollWidth > container.clientWidth) {
            e.preventDefault();
            scrollOptions.left = container.scrollLeft - scrollAmount;
            container.scrollTo(scrollOptions);
          }
          break;

        case 'PageDown':
          e.preventDefault();
          scrollOptions.top = container.scrollTop + container.clientHeight * 0.9;
          container.scrollTo(scrollOptions);
          break;

        case 'PageUp':
          e.preventDefault();
          scrollOptions.top = container.scrollTop - container.clientHeight * 0.9;
          container.scrollTo(scrollOptions);
          break;

        case 'Home':
          e.preventDefault();
          scrollOptions.top = 0;
          container.scrollTo(scrollOptions);
          break;

        case 'End':
          e.preventDefault();
          scrollOptions.top = container.scrollHeight;
          container.scrollTo(scrollOptions);
          break;

        default:
          break;
      }
    },
    [enabled, containerRef, scrollAmount, smoothScroll]
  );

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown, enabled]);

  return { containerRef };
}

// Hook for managing multiple scrollable containers with tab switching
export function useScrollableManager(
  containers: { ref: React.RefObject<HTMLElement | null>; enabled: boolean }[]
) {
  const activeIndexRef = useRef(0);

  const setActiveContainer = useCallback((index: number) => {
    if (index >= 0 && index < containers.length) {
      activeIndexRef.current = index;
      containers[index].ref.current?.focus();
    }
  }, [containers]);

  // Find and activate the first enabled container
  useEffect(() => {
    const enabledIndex = containers.findIndex((c) => c.enabled);
    if (enabledIndex >= 0) {
      activeIndexRef.current = enabledIndex;
    }
  }, [containers]);

  return { activeIndexRef, setActiveContainer };
}

// Global scroll handler for the entire app
export function useGlobalScroll() {
  const scrollableAreasRef = useRef<{
    main: React.RefObject<HTMLElement | null>;
    secondary: React.RefObject<HTMLElement | null>;
  }>({
    main: { current: null },
    secondary: { current: null },
  });

  return scrollableAreasRef;
}
