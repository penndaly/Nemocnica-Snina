import { cn } from '../lib/cn';

interface ImagePlaceholderProps {
  label?: string;
  aspectRatio?: '16/9' | '1/1' | '4/3';
  className?: string;
}

export function ImagePlaceholder({ label, aspectRatio = '16/9', className }: ImagePlaceholderProps) {
  const ratioClass =
    aspectRatio === '16/9' ? 'aspect-video' : aspectRatio === '1/1' ? 'aspect-square' : 'aspect-4/3';
  return (
    <div className={cn('ph w-full', ratioClass, className)} data-label={label ?? ''} role="img" aria-label={label} />
  );
}
