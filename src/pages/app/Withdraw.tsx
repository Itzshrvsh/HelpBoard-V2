import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { requestWithdrawal, subscribeToPlatformSettings } from '../../lib/firebaseServices';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatCredits, validateCreditAmount, compressImage } from '../../lib/utils';
import type { PlatformSettings } from '../../types';
import toast from 'react-hot-toast';

export default function Withdraw() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentDetails, setPaymentDetails] = useState('');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => setSettings(s));
    return unsub;
  }, []);

  const handleQrFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setQrFile(null);
      setQrPreview('');
      setError('');
      return;
    }

    // Validate PNG format
    if (file.type !== 'image/png') {
      setError('Please upload a PNG image');
      setQrFile(null);
      setQrPreview('');
      e.target.value = '';
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('QR code image must be under 2MB');
      setQrFile(null);
      setQrPreview('');
      e.target.value = '';
      return;
    }

    setQrFile(file);
    setError('');

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseInt(amount);
    if (!amountNum || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (settings) {
      const validationError = validateCreditAmount(amountNum, settings.minWithdrawal || 100, settings.maxWithdrawal || 10000);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    if (amountNum > (userProfile?.credits || 0)) {
      setError('Insufficient credits');
      return;
    }

    if (!paymentDetails.trim()) {
      setError('Please provide payment details');
      return;
    }

    if (!qrFile) {
      setError('Please upload your QR code image');
      return;
    }

    setLoading(true);
    try {
      // Compress QR image to stay well under Firestore's 1MB doc limit
      const proofUrl = await compressImage(qrFile, 400, 0.8);

      await requestWithdrawal(amountNum, paymentDetails, proofUrl);
      toast.success('Withdrawal request submitted! Waiting for admin approval.');
      setAmount('');
      setPaymentDetails('');
      setQrFile(null);
      setQrPreview('');
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
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
      <h1 className="text-2xl font-bold text-white mb-2">Withdraw Credits</h1>
      <p className="text-surface-400 mb-8">Request to withdraw your earned credits</p>

      <Card className="!p-8">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary-500/5 border border-primary-500/10 mb-6">
          <span className="text-primary-400 text-sm">⚡ Your balance: {formatCredits(userProfile?.credits || 0)} credits</span>
          {settings && (
            <span className="text-surface-500 text-xs ml-auto">
              Min: {formatCredits(settings.minWithdrawal || 100)} · Max: {formatCredits(settings.maxWithdrawal || 10000)}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Amount to Withdraw"
            type="number"
            placeholder="100"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            icon={<span className="text-primary-400">⚡</span>}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">
              Upload QR Code <span className="text-xs text-surface-500">(PNG only)</span>
            </label>
            <input
              type="file"
              accept=".png,image/png"
              onChange={handleQrFileChange}
              className="w-full text-sm text-surface-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600/20 file:text-primary-400 hover:file:bg-primary-600/30 cursor-pointer"
              required
            />
            {qrPreview && (
              <div className="mt-3 bg-white p-2 rounded-xl inline-block">
                <img
                  src={qrPreview}
                  alt="QR Code Preview"
                  className="w-32 h-32 object-contain mx-auto rounded-lg"
                />
              </div>
            )}
            {qrFile && !qrPreview && (
              <p className="text-xs text-emerald-400 mt-1">Selected: {qrFile.name}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">
              Payment Details
            </label>
            <textarea
              value={paymentDetails}
              onChange={(e) => setPaymentDetails(e.target.value)}
              placeholder="Enter your UPI ID, bank account details, or payment address..."
              className="w-full bg-surface-800/50 border border-surface-700 text-white placeholder-surface-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm resize-none"
              rows={3}
              required
            />
          </div>

          {error && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
              {error}
            </motion.p>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Submit Withdrawal Request
          </Button>
        </form>
      </Card>

      {settings?.withdrawalRules && (
        <Card className="!p-4 mt-4">
          <p className="text-xs text-surface-400 whitespace-pre-wrap">
            {settings.withdrawalRules}
          </p>
        </Card>
      )}
    </motion.div>
  );
}
