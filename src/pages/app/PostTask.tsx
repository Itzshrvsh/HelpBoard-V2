import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { createTask, subscribeToPlatformSettings } from '../../lib/firebaseServices';
import Input, { TextArea } from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatCredits, validateCreditAmount } from '../../lib/utils';
import type { PlatformSettings } from '../../types';
import toast from 'react-hot-toast';

export default function PostTask() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bounty, setBounty] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxClaims, setMaxClaims] = useState('3');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => setSettings(s));
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const bountyNum = parseInt(bounty);
    if (!bountyNum || bountyNum <= 0) {
      setError('Please enter a valid bounty amount');
      return;
    }

    if (!deadline) {
      setError('Please set a deadline');
      return;
    }

    if (settings) {
      const validationError = validateCreditAmount(bountyNum, settings.minTaskBounty || 1, settings.maxTaskBounty || 100000);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (bountyNum > (userProfile?.credits || 0)) {
      setError(`Insufficient credits. You have ${formatCredits(userProfile?.credits || 0)} credits.`);
      return;
    }

    setLoading(true);
    try {
      const taskId = await createTask({
        title,
        description,
        clientId: currentUser!.uid,
        clientName: userProfile?.displayName || 'Unknown',
        clientPhotoURL: userProfile?.photoURL || '',
        creditBounty: bountyNum,
        deadline: new Date(deadline) as any,
        maxClaims: parseInt(maxClaims),
        claimedHelpers: [],
        shortlistedHelpers: [],
        finalHelperId: null,
        status: 'open',
        escrowHeld: true,
        clientConfirmed: false,
        helperConfirmed: false,
      });

      toast.success('Task posted successfully!');
      navigate(`/tasks/${taskId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-2">Post a Task</h1>
      <p className="text-surface-400 mb-8">Describe what you need help with and set your bounty</p>

      <Card className="!p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-500/5 border border-primary-500/10">
            <span className="text-primary-400 text-sm">⚡ Your balance: {formatCredits(userProfile?.credits || 0)} credits</span>
          </div>

          <Input
            label="Task Title"
            placeholder="e.g., Need help with logo design"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <TextArea
            label="Description"
            placeholder="Describe your task in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={4}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Credit Bounty"
              type="number"
              placeholder="100"
              value={bounty}
              onChange={(e) => setBounty(e.target.value)}
              required
              icon={<span className="text-primary-400">⚡</span>}
            />

            <Input
              label="Max Claim Slots"
              type="number"
              placeholder="3"
              min="1"
              max="10"
              value={maxClaims}
              onChange={(e) => setMaxClaims(e.target.value)}
              required
            />
          </div>

          <Input
            label="Deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            required
          />

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
              {error}
            </motion.p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Post Task
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}
