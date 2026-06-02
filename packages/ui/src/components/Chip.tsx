import * as React from 'react';
import { cn } from '../lib/cn';

interface ChipProps {
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Chip({ icon, className, children }: ChipProps) {
  return (
    <span className={cn('chip', className)}>
      {icon}
      {children}
    </span>
  );
}
