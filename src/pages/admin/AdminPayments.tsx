import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToCreditRequests, approveCreditRequest, rejectCreditRequest } from '../../lib/firebaseServices';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function AdminPayments() {
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    const unsub = subscribeToCreditRequests(setRequests as any);
    return unsub;
  }, []);

  const handleApprove = async (requestId: string, userId: string, amount: number) => {
    if (!currentUser) return;
    try {
      await approveCreditRequest(requestId, userId, amount, currentUser.uid);
      toast.success('Payment approved!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReject = async () => {
    if (!currentUser || !rejectModal) return;
    try {
      await rejectCreditRequest(rejectModal.id, currentUser.uid, rejectReason);
      toast.success('Payment rejected');
      setRejectModal(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const pending = requests.filter((r: any) => r.status === 'pending');
  const history = requests.filter((r: any) => r.status !== 'pending');

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Payment Approvals</h1>

      <h2 className="text-lg font-semibold text-white mb-4">Pending ({pending.length})</h2>
      <div className="space-y-3 mb-8">
        {pending.map((req: any) => (
          <Card key={req.id} className="!p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{req.userEmail || req.userId}</p>
                <p className="text-sm text-primary-400 font-semibold">⚡ {formatCredits(req.amount)}</p>
                <p className="text-xs text-surface-400">{req.paymentMethod} · {formatTimestamp(req.createdAt)}</p>
                {req.proofUrl && (
                  <a href={req.proofUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-400 hover:underline">
                    View Proof
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => handleApprove(req.id, req.userId, req.amount)}>Approve</Button>
                <Button size="sm" variant="danger" onClick={() => setRejectModal({ id: req.id })}>Reject</Button>
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
        {history.map((req: any) => (
          <Card key={req.id} className="!p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-300">{req.userEmail}</p>
                <p className="text-xs text-surface-400">⚡ {formatCredits(req.amount)} · {req.paymentMethod}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {req.status}
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Payment">
        <div className="space-y-4">
          <Input label="Reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          <Button variant="danger" onClick={handleReject} className="w-full">Reject Payment</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
