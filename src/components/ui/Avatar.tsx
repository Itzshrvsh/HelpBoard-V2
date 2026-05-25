import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  uid?: string;
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ src, name, size = 'md', uid, className }: AvatarProps) {
  const initials = name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const content = src ? (
    <img
      src={src}
      alt={name}
      className={cn('w-full h-full object-cover rounded-full', className)}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
      }}
    />
  ) : null;

  const fallback = (
    <div className={cn(
      'w-full h-full rounded-full bg-primary-600/20 text-primary-400 flex items-center justify-center font-medium',
      !src && 'flex'
    )}>
      {initials}
    </div>
  );

  const avatar = (
    <div className={cn('relative rounded-full overflow-hidden flex-shrink-0', sizeClasses[size], className)}>
      {content}
      {fallback}
    </div>
  );

  if (uid) {
    return (
      <Link to={`/profile/${uid}`} className="hover:opacity-80 transition-opacity">
        {avatar}
      </Link>
    );
  }

  return avatar;
}
