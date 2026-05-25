import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { formatCredits } from '../../lib/utils';

export default function Credits() {
  const { userProfile } = useAuth();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-6">Credits</h1>

      {/* Balance */}
      <Card className="!p-8 text-center mb-6">
        <p className="text-surface-400 text-sm mb-2">Your Balance</p>
        <p className="text-5xl font-bold text-primary-400 mb-1">⚡ {formatCredits(userProfile?.credits || 0)}</p>
        <p className="text-surface-500 text-sm">credits</p>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <Link to="/buy-credits">
          <Card className="!p-6 text-center hover:border-primary-500/30">
            <div className="text-3xl mb-3">💳</div>
            <h3 className="text-lg font-semibold text-white mb-1">Buy Credits</h3>
            <p className="text-sm text-surface-400">Purchase credits using QR payment</p>
          </Card>
        </Link>
        <Link to="/withdraw">
          <Card className="!p-6 text-center hover:border-primary-500/30">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-lg font-semibold text-white mb-1">Withdraw</h3>
            <p className="text-sm text-surface-400">Request credit withdrawal</p>
          </Card>
        </Link>
      </div>

      <Link to="/transactions">
        <Button variant="secondary" className="w-full">
          View Transaction History
        </Button>
      </Link>
    </motion.div>
  );
}
