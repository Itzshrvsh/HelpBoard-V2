import React, { useState, useEffect, useRef } from 'react';
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
  const [qrUploading, setQrUploading] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false); // prevents onSnapshot from overwriting qrPaymentImage during upload

  useEffect(() => {
    const unsub = subscribeToPlatformSettings((s) => {
      setSettings(s);
      if (s && !uploadingRef.current) {
        // Only sync qrPaymentImage from Firestore when NOT in the middle of an upload
        // Prevents the onSnapshot listener from overwriting the preview URL or new download URL
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

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Save previous QR URL so we can restore it on failure
    const previousQrUrl = form.qrPaymentImage;

    // Prevent Firestore onSnapshot from overwriting qrPaymentImage during upload
    uploadingRef.current = true;
    setQrUploading(true);

    try {
      // Read & compress the image client-side, then save directly to Firestore
      // QR codes are small, so a compressed base64 data URL fits well within Firestore limits
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const img = new Image();
          img.onload = () => {
            // Resize to max 400px on longest side (QR codes don't need high res)
            let { width, height } = img;
            const MAX_SIZE = 400;
            if (width > MAX_SIZE || height > MAX_SIZE) {
              if (width > height) {
                height = Math.round((height / width) * MAX_SIZE);
                width = MAX_SIZE;
              } else {
                width = Math.round((width / height) * MAX_SIZE);
                height = MAX_SIZE;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to process image'));
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);

            // Export as JPEG at 70% quality → tiny size, QR still scannable
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            resolve(compressedDataUrl);
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = ev.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      // Show the compressed preview immediately
      setForm((prev) => ({ ...prev, qrPaymentImage: dataUrl }));

      // Save directly to Firestore (no Storage upload needed)
      if (currentUser) {
        await updatePlatformSettings({ qrPaymentImage: dataUrl });
        toast.success('QR image saved!');
      }
    } catch (err: any) {
      console.error('QR upload error:', err);
      // Restore the previous QR URL so the image doesn't disappear on failure
      if (previousQrUrl) {
        setForm((prev) => ({ ...prev, qrPaymentImage: previousQrUrl }));
      } else {
        setForm((prev) => ({ ...prev, qrPaymentImage: '' }));
      }
      toast.error(err.message || 'Failed to upload QR image. Please try again.');
    } finally {
      uploadingRef.current = false;
      setQrUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveQr = async () => {
    setForm((prev) => ({ ...prev, qrPaymentImage: '' }));
    // Auto-save removal
    if (currentUser) {
      try {
        await updatePlatformSettings({ qrPaymentImage: '' });
        toast.success('QR image removed');
      } catch (err: any) {
        console.error('Remove QR error:', err);
      }
    }
  };

  const handleSave = async () => {
    if (!currentUser) return;
    if (qrUploading) {
      toast.error('Please wait for the QR upload to complete');
      return;
    }
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

          {/* QR Image Preview & Upload */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-surface-300">
              QR Payment Image
            </label>

            {/* Current QR Preview */}
            {form.qrPaymentImage ? (
              <div className="relative inline-block bg-white p-3 rounded-xl">
                {qrImageError ? (
                  <div className="w-40 h-40 flex items-center justify-center">
                    <p className="text-red-400 text-xs text-center">Failed to load image</p>
                  </div>
                ) : (
                  <img
                    src={form.qrPaymentImage}
                    alt="Payment QR Code"
                    className="w-40 h-40 object-contain"
                    onError={() => setQrImageError(true)}
                  />
                )}
                <button
                  type="button"
                  onClick={handleRemoveQr}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-400 transition-colors shadow-lg"
                  title="Remove QR image"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="w-40 h-40 bg-surface-800 rounded-xl flex items-center justify-center border-2 border-dashed border-surface-700">
                <p className="text-surface-500 text-xs text-center px-2">No QR image set</p>
              </div>
            )}

            {/* Upload / URL Options */}
            <div className="space-y-3">
              <label className="relative flex items-center justify-center px-4 py-3 border-2 border-dashed border-surface-700 rounded-xl cursor-pointer hover:border-primary-500/50 transition-colors bg-surface-800/30">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={qrUploading}
                />
                <div className="flex items-center gap-2 text-sm">
                  {qrUploading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-primary-400" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span className="text-primary-400">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M16 8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="text-surface-300">Upload QR image</span>
                    </>
                  )}
                </div>
              </label>

              <div className="text-center text-xs text-surface-500">— or enter URL directly —</div>

              <Input
                label="QR Image URL (alternative)"
                value={form.qrPaymentImage}
                onChange={(e) => setForm({ ...form, qrPaymentImage: e.target.value })}
                onBlur={() => {
                  if (form.qrPaymentImage && currentUser && !qrUploading) {
                    updatePlatformSettings({ qrPaymentImage: form.qrPaymentImage }).catch(() => {});
                  }
                }}
                placeholder="https://example.com/qr.png"
              />
            </div>
          </div>

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
