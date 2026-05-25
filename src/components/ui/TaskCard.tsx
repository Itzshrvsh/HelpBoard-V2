import React from 'react';
import { Link } from 'react-router-dom';
import Card from './Card';
import Avatar from './Avatar';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';
import { formatRelativeTime, formatCredits } from '../../lib/utils';
import type { Task } from '../../types';

interface TaskCardProps {
  task: Task;
  showActions?: boolean;
  onClaim?: () => void;
}

export default function TaskCard({ task, showActions = true, onClaim }: TaskCardProps) {
  return (
    <Card glow className="h-full flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <Avatar src={task.clientPhotoURL} name={task.clientName} uid={task.clientId} size="md" />
        <div className="flex-1 min-w-0">
          <Link to={`/tasks/${task.id}`} className="text-base font-semibold text-white hover:text-primary-400 transition-colors line-clamp-1">
            {task.title}
          </Link>
          <Link to={`/profile/${task.clientId}`} className="text-xs text-surface-400 hover:text-surface-300 transition-colors">
            by {task.clientName}
          </Link>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <p className="text-sm text-surface-400 mb-4 line-clamp-2 flex-1">
        {task.description}
      </p>

      <div className="flex items-center justify-between pt-3 border-t border-surface-800/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-semibold text-primary-400">
            ⚡ {formatCredits(task.creditBounty)}
          </span>
          <span className="text-xs text-surface-500">
            {task.claimedHelpers.length}/{task.maxClaims} slots
          </span>
        </div>
        <div className="flex items-center gap-2">
          <CountdownTimer deadline={task.deadline} size="sm" />
          {showActions && task.status === 'open' && onClaim && (
            <button
              onClick={onClaim}
              className="text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors font-medium"
            >
              Claim
            </button>
          )}
          {showActions && (task.status === 'assigned' || task.status === 'in_progress' || task.status === 'pending_confirmation') && (
            <Link
              to={`/tasks/${task.id}`}
              className="text-xs px-3 py-1.5 bg-surface-700 hover:bg-surface-600 text-surface-200 rounded-lg transition-colors font-medium"
            >
              View
            </Link>
          )}
        </div>
      </div>

      <div className="mt-2 text-xs text-surface-500">
        {formatRelativeTime(task.createdAt)}
      </div>
    </Card>
  );
}
