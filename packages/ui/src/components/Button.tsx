import * as React from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'terra' | 'ghost' | 'emergency';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  asChild?: boolean;
  href?: string;
}

const variantClass: Record<Variant, string> = {
  primary: 'btn-primary',
  terra: 'btn-terra',
  ghost: 'btn-ghost',
  emergency: 'btn-emergency',
};

const sizeClass: Record<Size, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', block, href, children, ...props }, ref) => {
    const classes = cn('btn', variantClass[variant], sizeClass[size], block && 'btn-block', className);

    if (href) {
      return (
        <a href={href} className={classes}>
          {children}
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
