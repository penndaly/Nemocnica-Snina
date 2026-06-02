import * as React from 'react';
import { cn } from '../lib/cn';

type BadgeColor = 'green' | 'amber' | 'red' | 'blue' | 'terra' | 'gray';

interface BadgeProps {
  color?: BadgeColor;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}

const colorClass: Record<BadgeColor, string> = {
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
  blue: 'badge-blue',
  terra: 'badge-terra',
  gray: 'badge-gray',
};

export function Badge({ color = 'blue', dot = false, className, children }: BadgeProps) {
  return (
    <span className={cn('badge', colorClass[color], className)}>
      {dot && <span className="dot" aria-hidden />}
      {children}
    </span>
  );
}
