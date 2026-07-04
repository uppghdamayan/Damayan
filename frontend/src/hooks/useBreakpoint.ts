'use client';

import { useState, useEffect } from 'react';

export function useBreakpoint() {
  const [width, setWidth] = useState<number>(
    typeof window === 'undefined' ? 1440 : window.innerWidth
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    width,
    isDesktopLg: width >= 1440,
    isDesktop: width >= 1280 && width < 1440,
    isTabletLg: width >= 1024 && width < 1280,
    isTablet: width >= 768 && width < 1024,
    isMobile: width < 768,
    // helpers
    isAtLeastDesktop: width >= 1280,
    isAtLeastTabletLg: width >= 1024,
    isAtLeastTablet: width >= 768,
  };
}
