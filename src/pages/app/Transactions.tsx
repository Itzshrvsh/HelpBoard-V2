import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToTransactions } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import type { Transaction } from '../../types';

export default function Transactions() {
  const { currentUser } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToTransactions(currentUser.uid, (txns) => {
      setTransactions(txns);
      setLoading(false);
    });
    return unsub;
  }, [currentUser]);

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-2">Transaction History</h1>
      <p className="text-surface-400 mb-6">View all your credit transactions</p>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['all', 'purchase', 'withdrawal', 'escrow_release', 'escrow_hold', 'admin_adjustment'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              filter === f ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center !p-12">
          <p className="text-surface-400">No transactions found</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((txn) => (
            <Card key={txn.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{txn.description}</p>
                  <p className="text-xs text-surface-400">{formatTimestamp(txn.createdAt)}</p>
                  {txn.type === 'purchase' && <span className="text-xs text-emerald-400">Credit Purchase</span>}
                  {txn.type === 'withdrawal' && <span className="text-xs text-orange-400">Withdrawal</span>}
                  {txn.type === 'escrow_release' && <span className="text-xs text-emerald-400">Payment Received</span>}
                  {txn.type === 'escrow_hold' && <span className="text-xs text-blue-400">Escrow Hold</span>}
                  {txn.type === 'admin_adjustment' && <span className="text-xs text-purple-400">Admin Adjustment</span>}
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txn.netAmount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {txn.netAmount > 0 ? '+' : ''}{txn.netAmount}
                  </p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    txn.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    txn.status === 'pending' ? 'bg-amber-500/10 text-amber-400' :
                    txn.status === 'rejected' ? 'bg-red-500/10 text-red-400' :
                    'bg-surface-500/10 text-surface-400'
                  }`}>
                    {txn.status}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
