import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToTasks, claimTask } from '../../lib/firebaseServices';
import TaskCard from '../../components/ui/TaskCard';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import type { Task, TaskStatus } from '../../types';
import toast from 'react-hot-toast';

const statusFilters: TaskStatus[] = ['open', 'claimed', 'shortlisted', 'assigned'];

export default function Browse() {
  const { currentUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTasks((t) => {
      setTasks(t);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleClaim = async (taskId: string) => {
    if (!currentUser) return;
    try {
      await claimTask(taskId, currentUser.uid, currentUser.displayName || 'Unknown');
      toast.success('Task claimed successfully!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const openCount = tasks.filter(t => t.status === 'open').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Browse Tasks</h1>
          <p className="text-surface-400 text-sm mt-1">{openCount} tasks available</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
            filter === 'all' ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
          }`}
        >
          All
        </button>
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === s ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="text-center !p-12">
          <p className="text-surface-400 text-lg mb-2">No tasks found</p>
          <p className="text-surface-500 text-sm">Check back later for new opportunities</p>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClaim={task.status === 'open' ? () => handleClaim(task.id) : undefined}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}
