import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToPlatformSettings, updatePlatformSettings } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import type { PlatformSettings } from '../../types';
import toast from 'react-hot-toast';

export default function AdminSettings() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [form, setForm] = useState({
    platformFeePercent: '5',
    minWithdrawal: '100',
    maxWithdrawal: '10000',
    minTaskBounty: '1',
    maxTaskBounty: '100000',
    qrPaymentImage: '',
    paymentInstructions: '',
    withdrawalRules: '',
    maintenanceMode: 'false',
  });

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => {
      setSettings(s);
      if (s) {
        setForm({
          platformFeePercent: String(s.platformFeePercent || 5),
          minWithdrawal: String(s.minWithdrawal || 100),
          maxWithdrawal: String(s.maxWithdrawal || 10000),
          minTaskBounty: String(s.minTaskBounty || 1),
          maxTaskBounty: String(s.maxTaskBounty || 100000),
          qrPaymentImage: s.qrPaymentImage || '',
          paymentInstructions: s.paymentInstructions || '',
          withdrawalRules: s.withdrawalRules || '',
          maintenanceMode: String(s.maintenanceMode || false),
        });
      }
    });
    return unsub;
  }, []);

  const handleSave = async () => {
    if (!currentUser) return;
    try {
      await updatePlatformSettings({
        platformFeePercent: parseInt(form.platformFeePercent) || 5,
        minWithdrawal: parseInt(form.minWithdrawal) || 100,
        maxWithdrawal: parseInt(form.maxWithdrawal) || 10000,
        minTaskBounty: parseInt(form.minTaskBounty) || 1,
        maxTaskBounty: parseInt(form.maxTaskBounty) || 100000,
        qrPaymentImage: form.qrPaymentImage,
        paymentInstructions: form.paymentInstructions,
        withdrawalRules: form.withdrawalRules,
        maintenanceMode: form.maintenanceMode === 'true',
      });
      toast.success('Settings saved!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Platform Settings</h1>

      <Card className="!p-6">
        <div className="space-y-5">
          <h3 className="text-lg font-semibold text-white">Fee & Limits</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Platform Fee (%)"
              type="number"
              value={form.platformFeePercent}
              onChange={(e) => setForm({ ...form, platformFeePercent: e.target.value })}
            />
            <div />
            <Input
              label="Min Withdrawal"
              type="number"
              value={form.minWithdrawal}
              onChange={(e) => setForm({ ...form, minWithdrawal: e.target.value })}
            />
            <Input
              label="Max Withdrawal"
              type="number"
              value={form.maxWithdrawal}
              onChange={(e) => setForm({ ...form, maxWithdrawal: e.target.value })}
            />
            <Input
              label="Min Task Bounty"
              type="number"
              value={form.minTaskBounty}
              onChange={(e) => setForm({ ...form, minTaskBounty: e.target.value })}
            />
            <Input
              label="Max Task Bounty"
              type="number"
              value={form.maxTaskBounty}
              onChange={(e) => setForm({ ...form, maxTaskBounty: e.target.value })}
            />
          </div>

          <hr className="border-surface-800" />
          <h3 className="text-lg font-semibold text-white">Payment Configuration</h3>

          <Input
            label="QR Payment Image URL"
            value={form.qrPaymentImage}
            onChange={(e) => setForm({ ...form, qrPaymentImage: e.target.value })}
            placeholder="https://example.com/qr.png"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Payment Instructions</label>
            <textarea
              value={form.paymentInstructions}
              onChange={(e) => setForm({ ...form, paymentInstructions: e.target.value })}
              className="w-full bg-surface-800/50 border border-surface-700 text-white placeholder-surface-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm resize-none"
              rows={3}
              placeholder="Instructions for users on how to pay..."
            />
          </div>

          <hr className="border-surface-800" />
          <h3 className="text-lg font-semibold text-white">Other</h3>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Withdrawal Rules</label>
            <textarea
              value={form.withdrawalRules}
              onChange={(e) => setForm({ ...form, withdrawalRules: e.target.value })}
              className="w-full bg-surface-800/50 border border-surface-700 text-white placeholder-surface-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm resize-none"
              rows={3}
              placeholder="Rules and terms for withdrawals..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Maintenance Mode</label>
            <select
              value={form.maintenanceMode}
              onChange={(e) => setForm({ ...form, maintenanceMode: e.target.value })}
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
            >
              <option value="false">Disabled</option>
              <option value="true">Enabled</option>
            </select>
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Settings
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}
