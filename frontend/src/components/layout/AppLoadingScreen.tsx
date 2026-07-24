'use client';

import { PlusCircle } from 'lucide-react';

/**
 * Full-viewport branded loading screen shown while the app bootstraps
 * (store hydration, session verification). Used instead of rendering
 * `null`, so the user always has visible feedback rather than a blank page.
 */
export function AppLoadingScreen({ label = 'DAMAYAN EMR' }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-bg flex flex-col items-center justify-center gap-4">
      {/* Logo mark */}
      <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
        <PlusCircle size={20} color="white" strokeWidth={3} />
      </div>
      <span className="text-[13px] font-semibold text-text-muted tracking-[0.3px]">
        {label}
      </span>
      {/* Subtle progress line */}
      <div className="w-[120px] h-[2px] bg-surface-3 rounded-full overflow-hidden mt-1">
        <div className="h-full bg-accent rounded-full animate-[startup-progress_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
