import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToTask, shortlistHelper, selectFinalHelper, startTaskProgress, helperRequestsCompletion, clientConfirmsCompletion, cancelTask, getChatByTaskAndHelper, submitRating, getUserProfile, raiseDispute, getWorkspaceByTask } from '../../lib/firebaseServices';
import { db } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import CountdownTimer from '../../components/ui/CountdownTimer';
import Modal from '../../components/ui/Modal';
import Input, { TextArea } from '../../components/ui/Input';
import { formatCredits, formatTimestamp } from '../../lib/utils';
import type { Task, UserProfile, DisputeReason, DisputeSeverity } from '../../types';
import toast from 'react-hot-toast';

export default function TaskDetail() {
  const { taskId } = useParams();
  const { currentUser, userProfile: myProfile } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [helpers, setHelpers] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingDesc, setRatingDesc] = useState('');
  const [ratingFor, setRatingFor] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Enhanced dispute state
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('other');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeSeverity, setDisputeSeverity] = useState<DisputeSeverity>('medium');
  const [disputeExpected, setDisputeExpected] = useState('');
  const [disputeActual, setDisputeActual] = useState('');

  useEffect(() => {
    if (!taskId) return;
    const unsub = subscribeToTask(taskId, async (t) => {
      setTask(t);
      setLoading(false);
      if (t) {
        // Load helper profiles
        const allHelpers = [...t.claimedHelpers];
        if (t.finalHelperId) allHelpers.push(t.finalHelperId);
        const uniqueHelpers = [...new Set(allHelpers)];
        const profiles: Record<string, UserProfile> = {};
        for (const uid of uniqueHelpers) {
          const profile = await getUserProfile(uid);
          if (profile) profiles[uid] = profile;
        }
        setHelpers(profiles);

        // Get workspace ID if assigned
        if (t.workspaceId) {
          setWorkspaceId(t.workspaceId);
        } else if (t.finalHelperId) {
          const ws = await getWorkspaceByTask(taskId);
          if (ws) setWorkspaceId(ws.id);
        }
      }
    });
    return unsub;
  }, [taskId]);

  const handleShortlist = async (helperId: string) => {
    if (!taskId) return;
    try {
      await shortlistHelper(taskId, helperId);
      toast.success('Helper shortlisted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSelectFinal = async (helperId: string) => {
    if (!taskId) return;
    try {
      await selectFinalHelper(taskId, helperId);
      toast.success('Final helper selected!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleStartWork = async () => {
    if (!taskId || !currentUser) return;
    try {
      await startTaskProgress(taskId, currentUser.uid);
      toast.success('Task is now in progress!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRequestCompletion = async () => {
    if (!taskId || !currentUser) return;
    try {
      await helperRequestsCompletion(taskId, currentUser.uid);
      toast.success('Completion requested! Waiting for client confirmation.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!taskId || !currentUser) return;
    try {
      await clientConfirmsCompletion(taskId, currentUser.uid);
      toast.success('Task completed! Credits released to helper.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCancel = async () => {
    if (!taskId || !currentUser) return;
    if (!window.confirm('Are you sure you want to cancel this task?')) return;
    try {
      await cancelTask(taskId, currentUser.uid);
      toast.success('Task cancelled');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRaiseDispute = async () => {
    if (!taskId || !currentUser || !myProfile) return;
    try {
      await raiseDispute(taskId, currentUser.uid, myProfile.displayName, {
        reason: disputeReason,
        description: disputeDesc,
        severity: disputeSeverity,
        expectedResult: disputeExpected,
        actualIssue: disputeActual,
      });
      setShowDisputeModal(false);
      setDisputeReason('other');
      setDisputeDesc('');
      setDisputeExpected('');
      setDisputeActual('');
      toast.success('Dispute raised. Admin will review it shortly.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to raise dispute');
    }
  };

  const handleOpenChat = async (helperId: string) => {
    if (!taskId) return;
    const chatId = await getChatByTaskAndHelper(taskId, helperId);
    if (chatId) {
      navigate(`/chats/${chatId}`);
    } else {
      navigate(`/chats?taskId=${taskId}&helperId=${helperId}`);
    }
  };

  const handleRate = async () => {
    if (!taskId || !currentUser || !ratingFor) return;
    try {
      await submitRating(taskId, ratingFor, ratingScore, ratingDesc);
      toast.success('Rating submitted!');
      setShowRating(false);
      setRatingDesc('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const openRating = (userId: string) => {
    setRatingFor(userId);
    setRatingScore(5);
    setRatingDesc('');
    setShowRating(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-400">Task not found</p>
        <Link to="/dashboard" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">← Back to dashboard</Link>
      </div>
    );
  }

  const isClient = currentUser?.uid === task.clientId;
  const isHelper = currentUser?.uid === task.finalHelperId;
  const isClaimed = task.claimedHelpers.includes(currentUser?.uid || '');
  const isShortlisted = task.shortlistedHelpers.includes(currentUser?.uid || '');

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <Link to="/dashboard" className="text-sm text-surface-400 hover:text-white transition-colors mb-4 inline-block">
          ← Back to dashboard
        </Link>

        {/* Task Header */}
        <Card className="!p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <Avatar src={task.clientPhotoURL} name={task.clientName} uid={task.clientId} size="lg" />
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold text-white">{task.title}</h1>
                <StatusBadge status={task.status} size="md" />
              </div>
              <Link to={`/profile/${task.clientId}`} className="text-sm text-surface-400 hover:text-primary-400 transition-colors">
                Posted by {task.clientName}
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-1.5 text-sm bg-primary-500/10 text-primary-400 px-3 py-1.5 rounded-lg">
              ⚡ {formatCredits(task.creditBounty)} credits
            </div>
            <div className="flex items-center gap-1.5 text-sm bg-surface-800 text-surface-300 px-3 py-1.5 rounded-lg">
              🕐 <CountdownTimer deadline={task.deadline} />
            </div>
            <div className="flex items-center gap-1.5 text-sm bg-surface-800 text-surface-300 px-3 py-1.5 rounded-lg">
              👥 {task.claimedHelpers.length}/{task.maxClaims} slots filled
            </div>
          </div>

          <p className="text-surface-300 whitespace-pre-wrap">{task.description}</p>

          <div className="flex items-center gap-2 mt-4 text-xs text-surface-500">
            <span>Created {formatTimestamp(task.createdAt)}</span>
            {task.updatedAt && <span>· Updated {formatTimestamp(task.updatedAt)}</span>}
          </div>

          {/* Workspace Link - when assigned/in_progress/pending_confirmation/completed */}
          {(task.status === 'assigned' || task.status === 'in_progress' || task.status === 'pending_confirmation' || task.status === 'completed' || task.status === 'disputed' || task.status === 'rework') && workspaceId && (
            <div className="mt-4 pt-4 border-t border-surface-800/50">
              <Link to={`/workspace/${workspaceId}`}>
                <Button variant="secondary" className="w-full">
                  Open Project Workspace
                </Button>
              </Link>
            </div>
          )}

          {/* Rework Warning for Helper */}
          {task.status === 'rework' && isHelper && workspaceId && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔧</span>
                <p className="text-sm font-medium text-amber-400">Rework Required</p>
              </div>
              <p className="text-xs text-surface-400 mb-3">
                Admin has requested revisions. Please check the workspace for details and resubmit.
              </p>
              <Link to={`/workspace/${workspaceId}`}>
                <Button size="sm" className="w-full">Go to Workspace</Button>
              </Link>
            </div>
          )}

          {/* Client Actions */}
          {isClient && task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'disputed' && task.status !== 'rework' && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-800/50">
              {task.status === 'pending_confirmation' && (
                <Button onClick={handleConfirmCompletion}>Confirm & Release Credits</Button>
              )}
              {(task.status === 'open' || task.status === 'claimed' || task.status === 'shortlisted') && (
                <Button variant="ghost" onClick={handleCancel}>Cancel Task</Button>
              )}
              {task.status !== 'open' && task.status !== 'claimed' && task.status !== 'shortlisted' && (
                <Button variant="danger" size="sm" onClick={() => setShowDisputeModal(true)}>Raise Dispute</Button>
              )}
            </div>
          )}

          {/* Helper Actions */}
          {isHelper && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-surface-800/50">
              {task.status === 'assigned' && (
                <Button onClick={handleStartWork}>Start Working</Button>
              )}
              {task.status === 'in_progress' && (
                <Button onClick={handleRequestCompletion}>Request Completion</Button>
              )}
              {task.status !== 'completed' && task.status !== 'cancelled' && task.status !== 'disputed' && task.status !== 'rework' && (
                <Button variant="danger" size="sm" onClick={() => setShowDisputeModal(true)}>Raise Dispute</Button>
              )}
            </div>
          )}
        </Card>

        {/* Claimed Helpers */}
        {task.claimedHelpers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Helpers ({task.claimedHelpers.length})
            </h2>
            <div className="space-y-3">
              {task.claimedHelpers.map((helperId) => {
                const helper = helpers[helperId];
                if (!helper) return null;
                const isShortlisted = task.shortlistedHelpers.includes(helperId);
                const isFinal = task.finalHelperId === helperId;

                return (
                  <Card key={helperId} className="!p-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={helper.photoURL} name={helper.displayName} uid={helper.uid} size="md" />
                      <div className="flex-1">
                        <Link to={`/profile/${helper.uid}`} className="font-medium text-white hover:text-primary-400 transition-colors">
                          {helper.displayName}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-surface-400">
                          {isFinal && <span className="text-emerald-400">✓ Final Selection</span>}
                          {isShortlisted && !isFinal && <span className="text-amber-400">★ Shortlisted</span>}
                          {helper.helperRating > 0 && <span>⭐ {helper.helperRating}</span>}
                          <span>{helper.tasksCompleted} tasks done</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isClient && task.status === 'claimed' && !isShortlisted && (
                          <Button size="sm" variant="secondary" onClick={() => handleShortlist(helperId)}>
                            Shortlist
                          </Button>
                        )}
                        {isClient && isShortlisted && !isFinal && task.status !== 'assigned' && (
                          <Button size="sm" onClick={() => handleSelectFinal(helperId)}>
                            Select as Final
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleOpenChat(helperId)}>
                          Chat
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Rating section for completed tasks */}
        {task.status === 'completed' && (
          <Card className="!p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Rate This Task</h2>
            {isClient && (
              <Button onClick={() => openRating(task.finalHelperId!)}>
                Rate Helper
              </Button>
            )}
            {isHelper && (
              <Button onClick={() => openRating(task.clientId)}>
                Rate Client
              </Button>
            )}
          </Card>
        )}
      </motion.div>

      {/* Enhanced Dispute Modal */}
      <Modal isOpen={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Raise Dispute">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Reason</label>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value as DisputeReason)}
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
            >
              <option value="project_does_not_work">Project does not work</option>
              <option value="missing_features">Missing features</option>
              <option value="poor_quality">Poor quality</option>
              <option value="wrong_files">Wrong files uploaded</option>
              <option value="fake_proof">Fake proof video</option>
              <option value="malicious_files">Malicious/suspicious files</option>
              <option value="missing_setup_instructions">Setup instructions missing</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Severity</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high', 'critical'] as DisputeSeverity[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setDisputeSeverity(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                    disputeSeverity === s
                      ? s === 'critical' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30'
                        : s === 'high' ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30'
                        : s === 'medium' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30'
                        : 'bg-surface-800 text-surface-300 ring-1 ring-surface-700'
                      : 'bg-surface-800/50 text-surface-500 hover:text-surface-300'
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <TextArea
            label="Description"
            value={disputeDesc}
            onChange={(e) => setDisputeDesc(e.target.value)}
            rows={3}
            placeholder="Describe the issue in detail..."
          />

          <TextArea
            label="Expected Result"
            value={disputeExpected}
            onChange={(e) => setDisputeExpected(e.target.value)}
            rows={2}
            placeholder="What was supposed to happen?"
          />

          <TextArea
            label="Actual Issue"
            value={disputeActual}
            onChange={(e) => setDisputeActual(e.target.value)}
            rows={2}
            placeholder="What actually went wrong?"
          />

          <Button onClick={handleRaiseDispute} className="w-full" variant="danger">
            Submit Dispute
          </Button>
        </div>
      </Modal>

      {/* Rating Modal */}
      <Modal isOpen={showRating} onClose={() => setShowRating(false)} title="Submit Rating">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-surface-300">Rating:</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRatingScore(star)}
                  className={`text-2xl transition-colors ${star <= ratingScore ? 'text-amber-400' : 'text-surface-600'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <TextArea
            label="Description (optional)"
            placeholder="Share your experience..."
            value={ratingDesc}
            onChange={(e) => setRatingDesc(e.target.value)}
            rows={3}
          />
          <Button onClick={handleRate} className="w-full">
            Submit Rating
          </Button>
        </div>
      </Modal>
    </>
  );
}
