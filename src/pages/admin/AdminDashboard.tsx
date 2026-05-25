import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscribeToAllUsers, subscribeToAllTransactions, subscribeToCreditRequests, subscribeToWithdrawalRequests } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import { formatCredits } from '../../lib/utils';
import type { UserProfile, Transaction } from '../../types';

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditRequests, setCreditRequests] = useState<any[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeToAllUsers(setUsers),
      subscribeToAllTransactions(setTransactions as any),
      subscribeToCreditRequests(setCreditRequests as any),
      subscribeToWithdrawalRequests(setWithdrawalRequests as any),
    ];
    return () => unsubs.forEach(u => u());
  }, []);

  const totalCredits = users.reduce((sum, u) => sum + (u.credits || 0), 0);
  const totalUsers = users.length;
  const totalCompleted = transactions.filter(t => t.status === 'completed' && t.type === 'escrow_release').length;
  const pendingApprovals = creditRequests.filter((r: any) => r.status === 'pending').length + withdrawalRequests.filter((r: any) => r.status === 'pending').length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-white">{totalUsers}</p>
          <p className="text-xs text-surface-400">Total Users</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-primary-400">⚡ {formatCredits(totalCredits)}</p>
          <p className="text-xs text-surface-400">Total Credits</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-emerald-400">{totalCompleted}</p>
          <p className="text-xs text-surface-400">Completed Tasks</p>
        </Card>
        <Card className="text-center !p-4">
          <p className="text-2xl font-bold text-amber-400">{pendingApprovals}</p>
          <p className="text-xs text-surface-400">Pending Approvals</p>
        </Card>
      </div>

      <Card className="!p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {transactions.slice(0, 10).map((txn) => (
            <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-800/30">
              <div>
                <p className="text-sm text-surface-300">{txn.description}</p>
                <p className="text-xs text-surface-500">{txn.type} · {txn.status}</p>
              </div>
              <span className={`text-sm font-medium ${txn.netAmount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {txn.netAmount > 0 ? '+' : ''}{txn.netAmount}
              </span>
            </div>
          ))}
          {transactions.length === 0 && (
            <p className="text-sm text-surface-500 text-center py-4">No recent activity</p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
