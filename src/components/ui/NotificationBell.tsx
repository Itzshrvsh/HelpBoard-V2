import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToNotifications, markNotificationRead, markAllNotificationsRead } from '../../lib/firebaseServices';
import type { Notification } from '../../types';
import { formatRelativeTime } from '../../lib/utils';

interface Props {
  userId: string;
}

const notificationIcons: Record<string, string> = {
  helper_selected: '✅',
  new_message: '💬',
  progress_update: '📊',
  project_uploaded: '📦',
  video_proof_uploaded: '🎥',
  delivery_confirmed: '✅',
  credits_released: '💰',
  credits_added: '💳',
  credits_removed: '📤',
  rating_required: '⭐',
  dispute_raised: '⚖️',
  rework_requested: '🔧',
  revised_project_uploaded: '📦',
  task_reassigned: '🔄',
  dispute_resolved: '⚖️',
  admin_message: '📢',
};

export default function NotificationBell({ userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeToNotifications(userId, (notifs) => {
      setNotifications(notifs.slice(0, 20));
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleClick = (notif: Notification) => {
    markNotificationRead(notif.id);
    setOpen(false);
    if (notif.workspaceId) {
      navigate(`/workspace/${notif.workspaceId}`);
    } else if (notif.taskId) {
      navigate(`/tasks/${notif.taskId}`);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead(userId);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-surface-400 hover:text-white transition-colors rounded-lg hover:bg-surface-800"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 bg-surface-900 border border-surface-800 rounded-xl shadow-2xl overflow-hidden z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-surface-500 text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full px-4 py-3 text-left hover:bg-surface-800/50 transition-colors border-b border-surface-800/50 last:border-0 ${
                      !notif.read ? 'bg-primary-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5 flex-shrink-0">
                        {notificationIcons[notif.type] || '🔔'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notif.read ? 'text-white font-medium' : 'text-surface-300'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[10px] text-surface-600 mt-1">
                          {formatRelativeTime(notif.createdAt)}
                        </p>
                      </div>
                      {!notif.read && (
                        <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0 mt-2" />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
