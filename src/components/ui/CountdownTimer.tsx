import React, { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { getTimeRemaining } from '../../lib/utils';
import { cn } from '../../lib/utils';

interface CountdownTimerProps {
  deadline: Timestamp | null | undefined;
  size?: 'sm' | 'md';
  onExpired?: () => void;
}

export default function CountdownTimer({ deadline, size = 'sm', onExpired }: CountdownTimerProps) {
  const [time, setTime] = useState(getTimeRemaining(deadline));

  useEffect(() => {
    const interval = setInterval(() => {
      const newTime = getTimeRemaining(deadline);
      setTime(newTime);
      if (newTime.expired) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline, onExpired]);

  if (time.expired) {
    return (
      <span className={cn('text-red-400 font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
        Expired
      </span>
    );
  }

  const parts = [];
  if (time.days > 0) parts.push(`${time.days}d`);
  parts.push(`${time.hours}h`);
  parts.push(`${time.minutes}m`);

  return (
    <span className={cn('font-mono text-surface-300', size === 'sm' ? 'text-xs' : 'text-sm')}>
      {parts.join(' ')}
    </span>
  );
}
