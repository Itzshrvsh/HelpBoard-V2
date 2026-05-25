import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToUserTasks, subscribeToTasks } from '../../lib/firebaseServices';
import TaskCard from '../../components/ui/TaskCard';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatCredits } from '../../lib/utils';
import type { Task } from '../../types';

export default function Dashboard() {
  const { currentUser, userProfile, role } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    // Subscribe to both: tasks user posted AND tasks user claimed
    // This ensures all relevant tasks show regardless of role selector
    let clientTasks: Task[] = [];
    let helperTasks: Task[] = [];

    const emit = () => {
      // Merge and deduplicate by id
      const merged = [...clientTasks, ...helperTasks];
      const unique = merged.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i);
      unique.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setTasks(unique);
      setLoading(false);
    };

    const unsub1 = subscribeToUserTasks(currentUser.uid, 'client', (tasks) => {
      clientTasks = tasks; // Replace, don't append — onSnapshot gives full result set
      emit();
    });

    const unsub2 = subscribeToUserTasks(currentUser.uid, 'helper', (tasks) => {
      helperTasks = tasks;
      emit();
    });

    return () => { unsub1(); unsub2(); };
  }, [currentUser]);

  useEffect(() => {
    const unsub = subscribeToTasks((t) => {
      setOpenTasks(t.slice(0, 6));
    }, 'open');
    return unsub;
  }, []);

  if (!userProfile) return null;

  const activeTasks = tasks.filter(t => !['completed', 'cancelled', 'disputed'].includes(t.status));
  const completedTasks = tasks.filter(t => ['completed'].includes(t.status));

  return (
    <div className="space-y-8">
      {/* Welcome + Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white mb-1">
          Welcome back, {userProfile.displayName} 👋
        </h1>
        <p className="text-surface-400">
          You're currently in <strong className="text-primary-400">{role}</strong> mode
        </p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-primary-400">⚡ {formatCredits(userProfile.credits)}</p>
          <p className="text-xs text-surface-400 mt-1">Credits</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-white">{userProfile.tasksCompleted}</p>
          <p className="text-xs text-surface-400 mt-1">Completed</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-white">{activeTasks.length}</p>
          <p className="text-xs text-surface-400 mt-1">Active</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-amber-400">
            {role === 'helper' ? (userProfile.helperRating || '-') : (userProfile.clientRating || '-')}
          </p>
          <p className="text-xs text-surface-400 mt-1">Rating</p>
        </Card>
      </div>

      {/* Role-specific content */}
      {role === 'client' ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Tasks</h2>
            <Link to="/post-task">
              <Button size="sm">+ Post New Task</Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : activeTasks.length === 0 ? (
            <Card className="text-center !p-12">
              <p className="text-surface-400 mb-3">No active tasks yet</p>
              <Link to="/post-task">
                <Button>Post Your First Task</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} showActions={false} />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Your Claims</h2>
            <Link to="/browse">
              <Button size="sm">Browse Tasks</Button>
            </Link>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : activeTasks.length === 0 ? (
            <Card className="text-center !p-12">
              <p className="text-surface-400 mb-3">You haven't claimed any tasks yet</p>
              <Link to="/browse">
                <Button>Browse Available Tasks</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeTasks.map(task => (
                <TaskCard key={task.id} task={task} showActions={false} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Open tasks (for quick browse) */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Open Tasks</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openTasks.slice(0, 3).map(task => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
        {openTasks.length > 0 && (
          <div className="text-center mt-4">
            <Link to="/browse" className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
              View all open tasks →
            </Link>
          </div>
        )}
      </div>

      {/* Completed tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Completed Tasks</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedTasks.slice(0, 3).map(task => (
              <TaskCard key={task.id} task={task} showActions={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
