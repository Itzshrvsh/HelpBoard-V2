import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscribeToAdminLogs } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import { formatTimestamp } from '../../lib/utils';
import type { AdminLog } from '../../types';

export default function AdminLogs() {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const unsub = subscribeToAdminLogs(setLogs);
    return unsub;
  }, []);

  const filtered = filter ? logs.filter(l => l.action.includes(filter) || l.targetType.includes(filter)) : logs;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Admin Logs</h1>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['', 'user', 'payment', 'withdrawal', 'setting', 'dispute'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((log) => (
          <Card key={log.id} className="!p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-white">{log.action.replace(/_/g, ' ')}</p>
                <p className="text-xs text-surface-400">
                  Target: {log.targetType} ({log.targetId})
                </p>
                {log.reason && (
                  <p className="text-xs text-surface-500">Reason: {log.reason}</p>
                )}
                {log.oldValue && log.newValue && (
                  <p className="text-xs text-surface-500">
                    {log.oldValue} → {log.newValue}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-400">{formatTimestamp(log.createdAt)}</p>
                <p className="text-xs text-surface-500">by admin</p>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-surface-500 text-center py-8">No logs found</p>
        )}
      </div>
    </motion.div>
  );
}
