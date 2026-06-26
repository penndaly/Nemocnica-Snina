import { cn } from '../lib/cn';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'lg';
  className?: string;
}

function getInitials(name: string): string {
  return name
    .replace(/^(MUDr\.|Mgr\.|Bc\.|MBA\.?)\s*/gi, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

export function Avatar({ name, size = 'sm', className }: AvatarProps) {
  return (
    <div
      className={cn('avatar', size === 'lg' && 'avatar-lg', className)}
      aria-label={name}
      role="img"
    >
      {getInitials(name)}
    </div>
  );
}
