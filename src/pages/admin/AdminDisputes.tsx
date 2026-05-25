import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { requestRework, reassignTask, resolveDisputeEnhanced, getUserProfile, getWorkspaceByTask } from '../../lib/firebaseServices';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit, getDoc, doc } from 'firebase/firestore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import StatusBadge from '../../components/ui/StatusBadge';
import Avatar from '../../components/ui/Avatar';
import Input, { TextArea } from '../../components/ui/Input';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import type { Task, UserProfile, ProjectWorkspace, Dispute } from '../../types';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function AdminDisputes() {
  const { currentUser } = useAuth();
  const [disputedTasks, setDisputedTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [helperProfile, setHelperProfile] = useState<UserProfile | null>(null);
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Resolve modal
  const [resolveModal, setResolveModal] = useState<{ taskId: string } | null>(null);
  const [resolveAction, setResolveAction] = useState<'release_to_helper' | 'refund_client' | 'partial_refund'>('release_to_helper');
  const [resolveReason, setResolveReason] = useState('');
  const [partialAmount, setPartialAmount] = useState<number>(0);

  // Rework modal
  const [reworkModal, setReworkModal] = useState<{ taskId: string; disputeId?: string } | null>(null);
  const [reworkNote, setReworkNote] = useState('');
  const [reworkDays, setReworkDays] = useState(3);

  // Reassign modal
  const [reassignModal, setReassignModal] = useState<{ taskId: string } | null>(null);
  const [newHelperId, setNewHelperId] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'tasks'),
      where('status', 'in', ['disputed', 'rework']),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      setDisputedTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const viewDetail = async (task: Task) => {
    setSelectedTask(task);
    setShowDetail(true);
    const [client, helper] = await Promise.all([
      getUserProfile(task.clientId),
      task.finalHelperId ? getUserProfile(task.finalHelperId) : Promise.resolve(null),
    ]);
    setClientProfile(client);
    setHelperProfile(helper);
    if (task.workspaceId) {
      const ws = await getWorkspaceByTask(task.id);
      setWorkspace(ws);
    } else {
      setWorkspace(null);
    }
  };

  const handleResolve = async () => {
    if (!currentUser || !resolveModal) return;
    try {
      const partialAmt = resolveAction === 'partial_refund' ? partialAmount : undefined;
      await resolveDisputeEnhanced(resolveModal.taskId, currentUser.uid, currentUser.displayName || 'Admin', resolveAction, resolveReason, partialAmt);
      toast.success('Dispute resolved successfully!');
      setResolveModal(null);
      setResolveReason('');
      setShowDetail(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRequestRework = async () => {
    if (!currentUser || !reworkModal || !selectedTask) return;
    try {
      await requestRework(reworkModal.disputeId || 'dispute-placeholder', reworkModal.taskId, currentUser.uid, currentUser.displayName || 'Admin', reworkNote, reworkDays);
      toast.success('Rework requested! Helper has been notified.');
      setReworkModal(null);
      setReworkNote('');
      setShowDetail(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReassign = async () => {
    if (!currentUser || !reassignModal || !newHelperId.trim()) return;
    try {
      await reassignTask(reassignModal.taskId, newHelperId, 'New Helper', currentUser.uid, currentUser.displayName || 'Admin', reassignReason);
      toast.success('Task reassigned successfully!');
      setReassignModal(null);
      setNewHelperId('');
      setReassignReason('');
      setShowDetail(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredTasks = disputedTasks.filter(t =>
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">Dispute Resolution</h1>

      <Input
        placeholder="Search tasks or clients..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className="!p-12 text-center">
          <p className="text-surface-400 text-lg mb-2">No disputed tasks</p>
          <p className="text-surface-500 text-sm">All tasks are running smoothly</p>
        </Card>
      ) : !showDetail ? (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <Card key={task.id} className="!p-5 cursor-pointer hover:border-primary-500/30 transition-all" onClick={() => viewDetail(task)}>
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                    <StatusBadge status={task.status} />
                  </div>
                  <p className="text-sm text-surface-400 line-clamp-2">{task.description}</p>
                  <div className="flex items-center gap-3 text-sm text-surface-500">
                    <span>👤 {task.clientName}</span>
                    <span>⚡ {formatCredits(task.creditBounty)} bounty</span>
                    <span>🆔 {task.id.slice(0, 8)}...</span>
                    {task.finalHelperId && <span>✓ Helper: {helperProfile?.displayName || 'assigned'}</span>}
                  </div>
                  <p className="text-xs text-surface-500">
                    {task.status === 'disputed' ? 'Disputed' : 'Rework'} since: {formatTimestamp(task.updatedAt)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0 ml-4">
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); viewDetail(task); }}>
                    Review
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* Detail View */
        <div>
          <button
            onClick={() => setShowDetail(false)}
            className="text-sm text-surface-400 hover:text-white transition-colors mb-4 flex items-center gap-1"
          >
            ← Back to disputes
          </button>

          {selectedTask && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Task Info */}
                <Card className="!p-5">
                  <div className="flex items-start gap-4 mb-4">
                    <Avatar src={selectedTask.clientPhotoURL} name={selectedTask.clientName} uid={selectedTask.clientId} size="lg" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-xl font-bold text-white">{selectedTask.title}</h2>
                        <StatusBadge status={selectedTask.status} size="md" />
                      </div>
                      <p className="text-sm text-surface-400">Posted by {selectedTask.clientName}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mb-4">
                    <div className="text-sm bg-primary-500/10 text-primary-400 px-3 py-1.5 rounded-lg">
                      ⚡ {formatCredits(selectedTask.creditBounty)} credits
                    </div>
                    <div className="text-sm bg-surface-800 text-surface-300 px-3 py-1.5 rounded-lg">
                      🆔 {selectedTask.id}
                    </div>
                    <div className="text-sm bg-surface-800 text-surface-300 px-3 py-1.5 rounded-lg">
                      Created {formatTimestamp(selectedTask.createdAt)}
                    </div>
                  </div>

                  <p className="text-surface-300 whitespace-pre-wrap">{selectedTask.description}</p>
                </Card>

                {/* Participants */}
                <Card className="!p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Participants</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-lg">
                      <Avatar src={clientProfile?.photoURL || ''} name={selectedTask.clientName} uid={selectedTask.clientId} size="md" />
                      <div>
                        <p className="text-sm font-medium text-white">{selectedTask.clientName}</p>
                        <p className="text-xs text-surface-400">Client</p>
                      </div>
                    </div>
                    {helperProfile && (
                      <div className="flex items-center gap-3 p-3 bg-surface-800/50 rounded-lg">
                        <Avatar src={helperProfile.photoURL} name={helperProfile.displayName} uid={helperProfile.uid} size="md" />
                        <div>
                          <p className="text-sm font-medium text-white">{helperProfile.displayName}</p>
                          <p className="text-xs text-surface-400">Helper · ⭐ {helperProfile.helperRating || 'N/A'} · {helperProfile.tasksCompleted} tasks</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Workspace Link */}
                {workspace && (
                  <Card className="!p-5">
                    <h3 className="text-sm font-semibold text-white mb-3">Project Workspace</h3>
                    <Link to={`/workspace/${workspace.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary" size="sm" className="w-full">
                        Open Workspace (Chat, Files, Video)
                      </Button>
                    </Link>
                    <div className="mt-3 text-xs text-surface-500">
                      Workspace status: {workspace.status} · v{workspace.currentVersion}
                    </div>
                  </Card>
                )}
              </div>

              {/* Sidebar - Actions */}
              <div className="space-y-4">
                <Card className="!p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Admin Actions</h3>
                  <div className="space-y-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setResolveAction('release_to_helper');
                        setResolveModal({ taskId: selectedTask.id });
                      }}
                    >
                      Release Credits to Helper
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setResolveAction('refund_client');
                        setResolveModal({ taskId: selectedTask.id });
                      }}
                    >
                      Refund Client
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        setResolveAction('partial_refund');
                        setPartialAmount(Math.floor(selectedTask.creditBounty / 2));
                        setResolveModal({ taskId: selectedTask.id });
                      }}
                    >
                      Partial Refund
                    </Button>

                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => setReworkModal({ taskId: selectedTask.id })}
                    >
                      Request Helper Rework
                    </Button>

                    <Button
                      size="sm"
                      variant="danger"
                      className="w-full"
                      onClick={() => setReassignModal({ taskId: selectedTask.id })}
                    >
                      Reassign Task
                    </Button>
                  </div>
                </Card>

                {/* Dispute Info */}
                <Card className="!p-5">
                  <h3 className="text-sm font-semibold text-white mb-3">Status Info</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-surface-400">Task Status</span>
                      <StatusBadge status={selectedTask.status} size="sm" />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Escrow</span>
                      <span className={selectedTask.escrowHeld ? 'text-amber-400' : 'text-surface-500'}>
                        {selectedTask.escrowHeld ? 'Held' : 'Released'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Client Confirm</span>
                      <span className={selectedTask.clientConfirmed ? 'text-emerald-400' : 'text-surface-500'}>
                        {selectedTask.clientConfirmed ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Helper Confirm</span>
                      <span className={selectedTask.helperConfirmed ? 'text-emerald-400' : 'text-surface-500'}>
                        {selectedTask.helperConfirmed ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-surface-400">Workspace</span>
                      <span className="text-surface-300">{workspace ? '✓ Exists' : '—'}</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolve Modal */}
      <Modal isOpen={!!resolveModal} onClose={() => setResolveModal(null)} title="Resolve Dispute">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Action</label>
            <select
              value={resolveAction}
              onChange={(e) => setResolveAction(e.target.value as any)}
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
            >
              <option value="release_to_helper">Release Credits to Helper</option>
              <option value="refund_client">Full Refund to Client</option>
              <option value="partial_refund">Partial Refund</option>
            </select>
          </div>
          {resolveAction === 'partial_refund' && (
            <Input
              label={`Refund Amount (max: ${formatCredits(selectedTask?.creditBounty || 0)})`}
              type="number"
              value={partialAmount}
              onChange={(e) => setPartialAmount(Number(e.target.value))}
            />
          )}
          <TextArea
            label="Reason"
            value={resolveReason}
            onChange={(e) => setResolveReason(e.target.value)}
            rows={3}
            placeholder="Explain the resolution..."
          />
          <Button onClick={handleResolve} className="w-full">
            Resolve Dispute
          </Button>
        </div>
      </Modal>

      {/* Rework Modal */}
      <Modal isOpen={!!reworkModal} onClose={() => setReworkModal(null)} title="Request Helper Rework">
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
            🔧 This will notify the helper that revisions are required. The task will be moved to "rework" status.
          </div>
          <TextArea
            label="Note to Helper"
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            rows={3}
            placeholder="Describe what needs to be fixed..."
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Deadline (days)</label>
            <select
              value={reworkDays}
              onChange={(e) => setReworkDays(Number(e.target.value))}
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
            >
              <option value={1}>1 day</option>
              <option value={2}>2 days</option>
              <option value={3}>3 days</option>
              <option value={5}>5 days</option>
              <option value={7}>7 days</option>
            </select>
          </div>
          <Button onClick={handleRequestRework} className="w-full">
            Request Rework
          </Button>
        </div>
      </Modal>

      {/* Reassign Modal */}
      <Modal isOpen={!!reassignModal} onClose={() => setReassignModal(null)} title="Reassign Task">
        <div className="space-y-4">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-sm text-orange-400">
            🔄 This will reassign the task to a new helper. The original helper will be removed.
          </div>
          <Input
            label="New Helper ID"
            value={newHelperId}
            onChange={(e) => setNewHelperId(e.target.value)}
            placeholder="Enter the new helper's UID"
          />
          <TextArea
            label="Reason"
            value={reassignReason}
            onChange={(e) => setReassignReason(e.target.value)}
            rows={3}
            placeholder="Why is this task being reassigned?"
          />
          <Button onClick={handleReassign} className="w-full" variant="danger">
            Reassign Task
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
