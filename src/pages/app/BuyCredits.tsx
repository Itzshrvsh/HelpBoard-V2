import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { submitPaymentProof, subscribeToPlatformSettings } from '../../lib/firebaseServices';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatCredits, compressImage } from '../../lib/utils';
import type { PlatformSettings } from '../../types';
import toast from 'react-hot-toast';

export default function BuyCredits() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('QR Payment');
  const [loading, setLoading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => setSettings(s));
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const amountNum = parseInt(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid credit amount');
      return;
    }
    if (!proofFile) {
      toast.error('Please upload payment proof');
      (document.querySelector('input[type="file"]') as HTMLInputElement)?.focus();
      return;
    }

    setLoading(true);
    try {
      // Compress proof image to stay well under Firestore's 1MB doc limit
      const proofUrl = await compressImage(proofFile, 800, 0.8);

      await submitPaymentProof(amountNum, paymentMethod, proofUrl);
      toast.success('Payment proof submitted! Waiting for admin approval.');
      setAmount('');
      setProofFile(null);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      console.error('Payment submission error:', err);
      toast.error(err.message || 'Failed to submit payment. Please try again.');
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
      <h1 className="text-2xl font-bold text-white mb-2">Buy Credits</h1>
      <p className="text-surface-400 mb-8">Purchase credits to post tasks</p>

      <div className="grid sm:grid-cols-2 gap-6">
        {/* QR Code */}
        <Card className="!p-6 text-center">
          <h3 className="text-lg font-semibold text-white mb-4">Scan to Pay</h3>
          {settings?.qrPaymentImage ? (
            <div className="bg-white p-3 rounded-xl mb-3 inline-block">
              <img
                src={settings.qrPaymentImage}
                alt="Payment QR Code"
                className="w-48 h-48 object-contain mx-auto"
              />
            </div>
          ) : (
            <div className="w-48 h-48 mx-auto bg-surface-800 rounded-xl flex items-center justify-center mb-3">
              <p className="text-surface-500 text-sm">QR not configured</p>
            </div>
          )}
          {settings?.paymentInstructions && (
            <p className="text-xs text-surface-400 whitespace-pre-wrap mt-3">
              {settings.paymentInstructions}
            </p>
          )}
        </Card>

        {/* Payment Form */}
        <Card className="!p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Credit Amount"
              type="number"
              placeholder="100"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              icon={<span className="text-primary-400">⚡</span>}
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-300">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
              >
                <option value="QR Payment">QR Payment</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-300">
                Upload Payment Proof
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-surface-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600/20 file:text-primary-400 hover:file:bg-primary-600/30 cursor-pointer"
                required
              />
              {proofFile && (
                <p className="text-xs text-emerald-400 mt-1">Selected: {proofFile.name}</p>
              )}
            </div>

            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Submitting...' : 'Submit Payment Proof'}
            </Button>
          </form>
        </Card>
      </div>
    </motion.div>
  );
}
