'use client';

export function NarrowScreenNotice() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg p-8 text-center hidden @max-[767px]:flex">
      <div className="max-w-sm">
        <p className="text-[15px] font-bold text-text-primary mb-2">
          Screen too narrow
        </p>
        <p className="text-[13px] text-text-muted">
          DAMAYAN is designed for tablet, laptop, or desktop screens.
          Please use a device with a screen width of at least 768px.
        </p>
      </div>
    </div>
  );
}


