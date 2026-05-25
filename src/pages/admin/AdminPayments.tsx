import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCreditRequests, approveCreditRequest, rejectCreditRequest } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import type { CreditRequest } from '../../types';
import toast from 'react-hot-toast';

export default function AdminPayments() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<CreditRequest[]>([]);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedProof, setSelectedProof] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCreditRequests((data) => setRequests(data as CreditRequest[]));
    return unsub;
  }, []);

  const handleApprove = async (requestId: string, userId: string, amount: number) => {
    if (!currentUser) return;
    try {
      await approveCreditRequest(requestId, userId, amount, currentUser.uid);
      toast.success(`Approved ⚡ ${formatCredits(amount)} credit purchase`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReject = async () => {
    if (!currentUser || !rejectModal) return;
    try {
      await rejectCreditRequest(rejectModal.id, currentUser.uid, rejectReason);
      toast.success('Payment request rejected');
      setRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pending = requests.filter((r) => r.status === 'pending');
  const history = requests.filter((r) => r.status !== 'pending');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Payment Approvals</h1>

      <h2 className="text-lg font-semibold text-white mb-4">Pending ({pending.length})</h2>
      <div className="space-y-3 mb-8">
        {pending.map((req) => (
          <Card key={req.id} className="!p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{req.userEmail || req.userId}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg font-bold text-primary-400">⚡ {formatCredits(req.amount)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-800 text-surface-400">
                    {req.paymentMethod}
                  </span>
                </div>
                <p className="text-xs text-surface-500 mt-1">{formatTimestamp(req.createdAt)}</p>
                <div className="flex items-center gap-3 mt-2">
                  {req.proofUrl && (
                    <button
                      onClick={() => setSelectedProof(req.proofUrl)}
                      className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2"
                    >
                      View Payment Proof
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" onClick={() => handleApprove(req.id, req.userId, req.amount)}>
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectModal({ id: req.id })}>
                  Reject
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {pending.length === 0 && (
          <p className="text-sm text-surface-500 text-center py-4">No pending payment requests</p>
        )}
      </div>

      <h2 className="text-lg font-semibold text-white mb-4">History</h2>
      <div className="space-y-2">
        {history.map((req) => (
          <Card key={req.id} className="!p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-300">{req.userEmail}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-primary-400">⚡ {formatCredits(req.amount)}</span>
                  <span className="text-xs text-surface-500">· {req.paymentMethod}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {req.reason && (
                  <span className="text-xs text-surface-500 max-w-[200px] truncate" title={req.reason}>
                    {req.reason}
                  </span>
                )}
                <span className={`text-xs px-2 py-1 rounded-full ${
                  req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {req.status}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Payment Proof Image Preview Modal */}
      <Modal isOpen={!!selectedProof} onClose={() => setSelectedProof(null)} title="Payment Proof">
        {selectedProof && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={selectedProof}
              alt="Payment proof"
              className="max-w-full max-h-[70vh] rounded-lg object-contain"
            />
            <a
              href={selectedProof}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary-400 hover:underline"
            >
              Open in new tab ↗
            </a>
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Payment">
        <div className="space-y-4">
          <Input
            label="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Explain why this payment is rejected..."
          />
          <Button variant="danger" onClick={handleReject} className="w-full" disabled={!rejectReason.trim()}>
            Reject Payment
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
