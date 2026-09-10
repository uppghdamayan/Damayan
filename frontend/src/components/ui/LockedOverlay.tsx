'use client';

import { toast } from 'sonner';

interface LockedOverlayProps {
  message: string;
  toastId: string;
}

/**
 * Transparent click-interceptor for locked lists.
 * Absorbs interaction (replaces `pointer-events-none`) and surfaces a
 * bottom-right toast explaining why the list can't be edited right now.
 */
export function LockedOverlay({ message, toastId }: LockedOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-30 cursor-not-allowed"
      onClick={() => toast.info(message, { id: toastId })}
      onMouseDown={(e) => e.preventDefault()}
      aria-hidden
    />
  );
}
