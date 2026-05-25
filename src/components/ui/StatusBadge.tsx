import React from 'react';
import { cn } from '../../lib/utils';
import type { TaskStatus } from '../../types';

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  open: { label: 'Open', className: 'status-open' },
  claimed: { label: 'Claimed', className: 'status-claimed' },
  shortlisted: { label: 'Shortlisted', className: 'status-shortlisted' },
  assigned: { label: 'Assigned', className: 'status-assigned' },
  in_progress: { label: 'In Progress', className: 'status-in_progress' },
  pending_confirmation: { label: 'Pending Confirmation', className: 'status-pending_confirmation' },
  completed: { label: 'Completed', className: 'status-completed' },
  cancelled: { label: 'Cancelled', className: 'status-cancelled' },
  disputed: { label: 'Disputed', className: 'status-disputed' },
  reassigned: { label: 'Reassigned', className: 'status-assigned' },
  rework: { label: 'Rework', className: 'status-shortlisted' },
};

interface StatusBadgeProps {
  status: TaskStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.className,
        size === 'sm' ? 'text-xs px-2.5 py-0.5' : 'text-sm px-3 py-1'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', status === 'completed' ? 'bg-emerald-400' : status === 'open' ? 'bg-emerald-400' : 'bg-current')} />
      {config.label}
    </span>
  );
}
