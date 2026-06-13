'use client';

import React from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const shimmerKeyframes = `
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

let styleInjected = false;

function injectShimmerStyles() {
  if (styleInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
  styleInjected = true;
}

export function Skeleton({ width, height, borderRadius = 6, className, style }: SkeletonProps) {
  React.useEffect(() => {
    injectShimmerStyles();
  }, []);

  return (
    <div
      className={`shrink-0 bg-[linear-gradient(90deg,#EFF1F5_25%,#F7F8FA_50%,#EFF1F5_75%)] bg-[length:200%_100%] animate-[shimmer_1.5s_infinite_linear] ${className || ''}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}
