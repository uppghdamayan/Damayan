import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const sizeMap = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
};

export function Spinner({ size = 'sm', className }: SpinnerProps) {
  return (
    <Loader2 className={cn('animate-spin text-current', sizeMap[size], className)} />
  );
}
