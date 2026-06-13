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
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #EFF1F5 25%, #F7F8FA 50%, #EFF1F5 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite linear',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
