import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscribeToLeaderboard } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import { formatCredits } from '../../lib/utils';
import type { LeaderboardStats } from '../../types';

type SortBy = 'tasksCompleted' | 'creditsEarned' | 'rating';

export default function LeaderboardPage() {
  const [stats, setStats] = useState<LeaderboardStats[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('tasksCompleted');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToLeaderboard((data) => {
      setStats(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const sortedStats = [...stats].sort((a, b) => {
    switch (sortBy) {
      case 'tasksCompleted': return b.totalTasksCompleted - a.totalTasksCompleted;
      case 'creditsEarned': return b.totalCreditsEarned - a.totalCreditsEarned;
      case 'rating': return b.averageHelperRating - a.averageHelperRating;
      default: return 0;
    }
  });

  const getMedal = (index: number) => {
    switch (index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return `#${index + 1}`;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-2">Leaderboard</h1>
      <p className="text-surface-400 mb-6">Top performers on HelpBoard</p>

      {/* Sort Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'tasksCompleted', label: 'Most Tasks' },
          { key: 'creditsEarned', label: 'Most Earned' },
          { key: 'rating', label: 'Highest Rated' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key as SortBy)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortBy === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : sortedStats.length === 0 ? (
        <Card className="text-center !p-12">
          <p className="text-surface-400">No data yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedStats.slice(0, 20).map((entry, index) => (
            <motion.div
              key={entry.userId}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className={`!p-4 flex items-center gap-3 ${index < 3 ? 'border-primary-500/20' : ''}`}>
                <span className={`w-8 text-center text-lg ${index < 3 ? '' : 'text-surface-500 text-sm'}`}>
                  {getMedal(index)}
                </span>
                <Avatar src={entry.photoURL} name={entry.displayName} uid={entry.userId} size="md" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{entry.displayName}</p>
                  <p className="text-xs text-surface-400">
                    {entry.totalTasksCompleted} tasks · ⚡ {formatCredits(entry.totalCreditsEarned)} earned
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-amber-400">
                    {sortBy === 'rating' ? (entry.averageHelperRating || entry.averageClientRating || '-').toFixed(1) : formatCredits(sortBy === 'tasksCompleted' ? entry.totalTasksCompleted : entry.totalCreditsEarned)}
                  </p>
                  <p className="text-xs text-surface-500">
                    {sortBy === 'tasksCompleted' ? 'tasks' : sortBy === 'creditsEarned' ? 'credits' : 'rating'}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
