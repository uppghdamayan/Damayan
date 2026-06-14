'use client';

import { useEffect, useState } from 'react';

export function AppStartupLoader({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Zustand `persist` middleware hydrates synchronously after mount
    // One tick is enough to let it settle
    const t = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(t);
  }, []);

  if (!hydrated) {
    return (
      <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-4">
        {/* Logo mark */}
        <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 8V16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 12H16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-text-muted tracking-[0.3px]">
          DAMAYAN EMR
        </span>
        {/* Subtle progress line */}
        <div className="w-[120px] h-[2px] bg-surface-3 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-accent rounded-full animate-[startup-progress_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
