import * as React from 'react';
import { cn } from '../lib/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pad?: boolean;
  hover?: boolean;
}

export function Card({ pad = false, hover = false, className, children, ...props }: CardProps) {
  return (
    <div className={cn('card', pad && 'card-pad', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  );
}
