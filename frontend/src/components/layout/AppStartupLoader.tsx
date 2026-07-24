'use client';

import { useEffect, useState } from 'react';
import { AppLoadingScreen } from './AppLoadingScreen';

export function AppStartupLoader({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Zustand `persist` middleware hydrates synchronously after mount
    // One tick is enough to let it settle
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!hydrated) {
    return <AppLoadingScreen />;
  }

  return <>{children}</>;
}
