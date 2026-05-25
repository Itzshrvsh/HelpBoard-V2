import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../../lib/firebase';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc,
  serverTimestamp, Timestamp, updateDoc
} from 'firebase/firestore';
import {
  subscribeToTask, getUserProfile, subscribeToWorkspace, subscribeToProgressUpdates,
  subscribeToDeliveries, getWorkspaceByTask, addProgressUpdate, submitDelivery,
  confirmDelivery, logDownloadEvent, subscribeToMessages, sendMessage,
  raiseDispute, submitRevisedProject, subscribeToNotifications
} from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import Input, { TextArea } from '../../components/ui/Input';
import { formatCredits, formatTimestamp, formatRelativeTime } from '../../lib/utils';
import type {
  Task, UserProfile, ProjectWorkspace, ProgressUpdate, ProgressStatus,
  Delivery, DeliveryFile, DeliveryChecklist, ProofVideo, Message,
  DisputeReason, DisputeSeverity
} from '../../types';
import toast from 'react-hot-toast';

const defaultChecklist: DeliveryChecklist = {
  projectRuns: false,
  featuresCompleted: false,
  noMaliciousFiles: false,
  setupInstructionsIncluded: false,
  proofVideoUploaded: false,
  clientRequirementsChecked: false,
};

export default function ProjectWorkspacePage() {
  const { workspaceId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [clientProfile, setClientProfile] = useState<UserProfile | null>(null);
  const [helperProfile, setHelperProfile] = useState<UserProfile | null>(null);
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'chat' | 'progress' | 'delivery' | 'files'>('chat');

  // Chat state
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Progress update modal
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressTitle, setProgressTitle] = useState('');
  const [progressDesc, setProgressDesc] = useState('');
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>('in_progress');

  // Delivery modal
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [deliveryChecklist, setDeliveryChecklist] = useState<DeliveryChecklist>(defaultChecklist);
  const [uploadedFiles, setUploadedFiles] = useState<DeliveryFile[]>([]);
  const [proofVideo, setProofVideo] = useState<ProofVideo | null>(null);
  const [uploading, setUploading] = useState(false);

  // Dispute modal
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState<DisputeReason>('other');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [disputeSeverity, setDisputeSeverity] = useState<DisputeSeverity>('medium');
  const [disputeExpected, setDisputeExpected] = useState('');
  const [disputeActual, setDisputeActual] = useState('');

  // Rating modal
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingDesc, setRatingDesc] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const isClient = currentUser?.uid === workspace?.clientId;
  const isHelper = currentUser?.uid === workspace?.helperId;
  const isParticipant = isClient || isHelper;

  useEffect(() => {
    if (!workspaceId) return;

    const unsubWorkspace = subscribeToWorkspace(workspaceId, (ws) => {
      setWorkspace(ws);
    });

    return () => unsubWorkspace();
  }, [workspaceId]);

  // Separate effect: load profiles and subscribe to task when workspace changes
  // Keeps loading true until both workspace exists AND task/profile data is ready
  useEffect(() => {
    if (!workspace) {
      setLoading(false); // Workspace doesn't exist — stop loading, show "not found"
      return;
    }

    let unsubTask: (() => void) | null = null;
    let cancelled = false;

    const load = async () => {
      const [client, helper] = await Promise.all([
        getUserProfile(workspace.clientId),
        getUserProfile(workspace.helperId),
      ]);
      if (cancelled) return;
      setClientProfile(client);
      setHelperProfile(helper);

      if (workspace.taskId) {
        unsubTask = subscribeToTask(workspace.taskId, (t) => setTask(t));
      }
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
      if (unsubTask) unsubTask();
    };
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspaceId) return;
    const unsubProgress = subscribeToProgressUpdates(workspaceId, setProgressUpdates);
    const unsubDeliveries = subscribeToDeliveries(workspaceId, setDeliveries);
    const unsubMessages = subscribeToMessages(workspaceId, setMessages);
    return () => { unsubProgress(); unsubDeliveries(); unsubMessages(); };
  }, [workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle rating requirement after completion
  useEffect(() => {
    if (task?.status === 'completed' && !ratingSubmitted && !showRatingModal) {
      const timer = setTimeout(() => setShowRatingModal(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [task?.status]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !workspaceId || !currentUser) return;
    try {
      await sendMessage(workspaceId, messageText, 'text');
      setMessageText('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddProgress = async () => {
    if (!workspace || !currentUser || !helperProfile) return;
    try {
      await addProgressUpdate(
        workspace.id, workspace.taskId, currentUser.uid, helperProfile.displayName,
        { title: progressTitle, description: progressDesc, status: progressStatus }
      );
      setShowProgressModal(false);
      setProgressTitle('');
      setProgressDesc('');
      setProgressStatus('in_progress');
      toast.success('Progress update posted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleFileUpload = async (file: File): Promise<DeliveryFile> => {
    if (!workspace || !currentUser) throw new Error('Not authenticated');
    const path = `deliveries/${workspace.taskId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uploadedAt: Timestamp.now(),
    };
  };

  const handleVideoUpload = async (file: File): Promise<ProofVideo> => {
    if (!workspace || !currentUser) throw new Error('Not authenticated');
    const path = `proof-videos/${workspace.taskId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      size: file.size,
      uploadedBy: currentUser.uid,
      uploadedAt: Timestamp.now(),
    };
  };

  const handleSubmitDelivery = async () => {
    if (!workspace || !currentUser || uploadedFiles.length === 0) {
      toast.error('Please upload at least one project file');
      return;
    }
    if (!proofVideo) {
      toast.error('Please upload a proof/demo video');
      return;
    }
    if (!versionLabel.trim()) {
      toast.error('Please enter a version label');
      return;
    }

    setUploading(true);
    try {
      await submitDelivery(workspace.id, workspace.taskId, currentUser.uid, {
        deliveryNotes,
        versionLabel,
        checklist: deliveryChecklist,
        files: uploadedFiles,
        proofVideo,
      });
      setShowDeliveryModal(false);
      setDeliveryNotes('');
      setVersionLabel('');
      setDeliveryChecklist(defaultChecklist);
      setUploadedFiles([]);
      setProofVideo(null);
      toast.success('Project submitted successfully!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    if (!workspace || !task || !deliveries[0]) return;
    if (!window.confirm(
      'Confirm only after watching the proof video and verifying the delivered project matches your request.\n\n' +
      'Once confirmed, credits will be released to the helper and project download will be unlocked.'
    )) return;

    try {
      await confirmDelivery(workspace.id, task.id, deliveries[0].id, currentUser!.uid);
      toast.success('Delivery confirmed! Credits released to helper.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRaiseDispute = async () => {
    if (!task || !currentUser || !userProfile) return;
    try {
      await raiseDispute(task.id, currentUser.uid, userProfile.displayName, {
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
      toast.error(err.message);
    }
  };

  const handleDownload = async (file: DeliveryFile) => {
    if (!workspace || !task) return;
    if (!workspace.downloadEnabled && !isHelper) {
      toast.error('Download is locked until client confirms delivery');
      return;
    }
    try {
      await logDownloadEvent(file.name, currentUser!.uid, task.id, deliveries[0]?.id || '');
      window.open(file.url, '_blank');
      toast.success('Download started');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSubmitRating = async () => {
    if (!task || !currentUser) return;
    try {
      const { submitRating } = await import('../../lib/firebaseServices');
      const targetId = isClient ? task.finalHelperId! : task.clientId;
      await submitRating(task.id, targetId, ratingScore, ratingDesc);
      setRatingSubmitted(true);
      setShowRatingModal(false);
      toast.success('Rating submitted!');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Rework warning screen
  if (task?.status === 'rework' && isHelper) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto">
        <Card className="!p-8 !border-amber-500/30 !bg-amber-500/5">
          <div className="text-center mb-6">
            <span className="text-5xl">🔧</span>
            <h1 className="text-2xl font-bold text-white mt-4">Rework Required</h1>
            <p className="text-surface-300 mt-2 max-w-lg mx-auto">
              The client reported issues with your delivered project. Admin has reviewed the dispute
              and requested you to fix and resubmit the work.
            </p>
          </div>

          <div className="bg-surface-800/50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-surface-400 text-sm">Task</span>
              <span className="text-white font-medium">{task.title}</span>
            </div>
            {task.reworkDeadline && (
              <div className="flex items-center justify-between">
                <span className="text-surface-400 text-sm">Deadline</span>
                <span className="text-amber-400 font-medium">{formatTimestamp(task.reworkDeadline)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <Button onClick={() => setActiveTab('chat')}>
              Open Project Chat
            </Button>
            <Button onClick={() => setShowDeliveryModal(true)} variant="secondary">
              Upload Revised Project
            </Button>
          </div>
        </Card>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!workspace || !task) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-400">Workspace not found</p>
        <Link to="/dashboard" className="text-primary-400 hover:text-primary-300 mt-2 inline-block">← Back to dashboard</Link>
      </div>
    );
  }

  const latestDelivery = deliveries[0];
  const statusColors: Record<string, string> = {
    planning: 'bg-purple-500/20 text-purple-400',
    in_progress: 'bg-blue-500/20 text-blue-400',
    testing: 'bg-amber-500/20 text-amber-400',
    fixing: 'bg-orange-500/20 text-orange-400',
    finalizing: 'bg-indigo-500/20 text-indigo-400',
    submitted: 'bg-emerald-500/20 text-emerald-400',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/tasks/${task.id}`} className="text-surface-400 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{task.title}</h1>
          <p className="text-sm text-surface-400">Project Workspace</p>
        </div>
        <StatusBadge status={task.status} size="md" />
      </div>

      {/* Participants */}
      <div className="flex items-center gap-4 mb-6 bg-surface-900/50 border border-surface-800/50 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Avatar src={clientProfile?.photoURL || ''} name={task.clientName} uid={task.clientId} size="sm" />
          <div>
            <p className="text-xs text-surface-500">Client</p>
            <Link to={`/profile/${task.clientId}`} className="text-sm text-white hover:text-primary-400">
              {task.clientName}
            </Link>
          </div>
        </div>
        <span className="text-surface-600">🤝</span>
        <div className="flex items-center gap-3">
          <Avatar src={helperProfile?.photoURL || ''} name={helperProfile?.displayName || 'Helper'} uid={workspace.helperId} size="sm" />
          <div>
            <p className="text-xs text-surface-500">Helper</p>
            <Link to={`/profile/${workspace.helperId}`} className="text-sm text-white hover:text-primary-400">
              {helperProfile?.displayName || 'Helper'}
            </Link>
          </div>
        </div>
        <div className="ml-auto text-sm text-surface-400">
          ⚡ {formatCredits(task.creditBounty)} credits
        </div>
      </div>

      {/* Dispute Banner */}
      {task.status === 'disputed' && (
        <Card className="!p-4 !border-red-500/30 !bg-red-500/5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">⚖️</span>
            <div className="flex-1">
              <p className="text-white font-medium">Dispute Active</p>
              <p className="text-sm text-surface-400">An admin is reviewing this dispute. Downloads and confirmations are on hold.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Rework Banner */}
      {task.status === 'rework' && (
        <Card className="!p-4 !border-amber-500/30 !bg-amber-500/5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔧</span>
            <div className="flex-1">
              <p className="text-white font-medium">Rework in Progress</p>
              <p className="text-sm text-surface-400">Admin has requested rework. The helper is working on revisions.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-900/50 border border-surface-800/50 rounded-xl p-1 mb-6 overflow-x-auto">
        {[
          { id: 'chat', label: 'Chat', icon: '💬' },
          { id: 'progress', label: 'Progress', icon: '📊' },
          { id: 'delivery', label: 'Delivery', icon: '📦' },
          { id: 'files', label: 'Files', icon: '📁' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <Card className="!p-0 flex flex-col h-[600px]">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.senderId === currentUser?.uid ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar
                      src={msg.senderPhotoURL}
                      name={msg.senderName}
                      uid={msg.senderId}
                      size="sm"
                    />
                    <div className={`max-w-[75%] ${msg.senderId === currentUser?.uid ? 'items-end' : 'items-start'} flex flex-col`}>
                      {msg.type === 'system' ? (
                        <div className="bg-surface-800/50 text-surface-400 text-xs px-3 py-2 rounded-lg italic text-center w-full">
                          {msg.content}
                        </div>
                      ) : (
                        <>
                          <p className="text-[11px] text-surface-500 mb-0.5 px-1">{msg.senderName}</p>
                          <div className={`rounded-xl px-3.5 py-2 text-sm ${
                            msg.senderId === currentUser?.uid
                              ? 'bg-primary-500/20 text-white'
                              : 'bg-surface-800 text-surface-200'
                          }`}>
                            {msg.content}
                          </div>
                          <p className="text-[10px] text-surface-600 mt-0.5 px-1">
                            {formatRelativeTime(msg.createdAt)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-surface-800 p-3 flex gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                />
                <Button size="sm" onClick={handleSendMessage}>Send</Button>
              </div>
            </Card>
          )}

          {/* Progress Tab */}
          {activeTab === 'progress' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Progress Updates</h2>
                {isHelper && (
                  <Button size="sm" onClick={() => setShowProgressModal(true)}>
                    + Update
                  </Button>
                )}
              </div>

              {progressUpdates.length === 0 ? (
                <Card className="!p-8 text-center">
                  <p className="text-surface-500">No progress updates yet</p>
                  {isHelper && (
                    <p className="text-surface-600 text-sm mt-1">Post your first update to keep the client informed</p>
                  )}
                </Card>
              ) : (
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-surface-800" />

                  <div className="space-y-4">
                    {progressUpdates.map((update) => (
                      <div key={update.id} className="relative pl-12">
                        <div className="absolute left-3.5 top-1.5 w-3.5 h-3.5 rounded-full bg-primary-500 border-2 border-surface-900" />
                        <Card className="!p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-white font-medium">{update.title}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[update.status] || 'bg-surface-800 text-surface-400'}`}>
                                  {update.status.replace('_', ' ')}
                                </span>
                                <span className="text-xs text-surface-500">{formatRelativeTime(update.createdAt)}</span>
                              </div>
                            </div>
                            <span className="text-xs text-surface-500">{update.helperName}</span>
                          </div>
                          <p className="text-sm text-surface-300">{update.description}</p>
                          {update.fileUrl && (
                            <a
                              href={update.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary-400 hover:text-primary-300"
                            >
                              📎 {update.fileName || 'Attachment'}
                            </a>
                          )}
                        </Card>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delivery Tab */}
          {activeTab === 'delivery' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Delivery</h2>
                {isHelper && !workspace.deliveryConfirmed && task.status !== 'completed' && task.status !== 'disputed' && (
                  <Button size="sm" onClick={() => setShowDeliveryModal(true)}>
                    {task.status === 'rework' ? 'Upload Revised Project' : 'Submit Delivery'}
                  </Button>
                )}
              </div>

              {latestDelivery ? (
                <Card className="!p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-white font-medium">v{latestDelivery.version}: {latestDelivery.versionLabel || 'Delivery'}</h3>
                      <p className="text-xs text-surface-500 mt-1">
                        {latestDelivery.isRevision ? 'Revision' : 'Original'} · {formatTimestamp(latestDelivery.createdAt)}
                      </p>
                    </div>
                    {latestDelivery.status === 'confirmed' ? (
                      <span className="text-emerald-400 text-sm font-medium">✓ Confirmed</span>
                    ) : (
                      <StatusBadge status="pending_confirmation" size="sm" />
                    )}
                  </div>

                  <p className="text-sm text-surface-300 mb-4">{latestDelivery.deliveryNotes}</p>

                  {/* Delivery Checklist */}
                  <div className="bg-surface-800/50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-surface-400 mb-2 font-medium">Checklist</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(latestDelivery.checklist).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                          <span className={value ? 'text-emerald-400' : 'text-surface-600'}>
                            {value ? '✓' : '○'}
                          </span>
                          <span className="text-surface-400">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Files */}
                  {latestDelivery.files.length > 0 && (
                    <div className="space-y-2 mb-4">
                      <p className="text-xs text-surface-400 font-medium">Files</p>
                      {latestDelivery.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-surface-800/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-surface-400">📄</span>
                            <span className="text-sm text-surface-200">{file.name}</span>
                            <span className="text-xs text-surface-500">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(file)}
                            disabled={!workspace.downloadEnabled && !isHelper}
                          >
                            {workspace.downloadEnabled || isHelper ? 'Download' : '🔒'}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Proof Video */}
                  {latestDelivery.proofVideo && (
                    <div className="mb-4">
                      <p className="text-xs text-surface-400 font-medium mb-2">Proof Video</p>
                      <div className="bg-surface-800/50 rounded-lg overflow-hidden">
                        <video
                          src={latestDelivery.proofVideo.url}
                          controls
                          className="w-full max-h-64"
                          preload="metadata"
                        >
                          Your browser doesn't support video playback.
                        </video>
                        <div className="px-3 py-2 flex items-center justify-between">
                          <span className="text-xs text-surface-400">{latestDelivery.proofVideo.name}</span>
                          <span className="text-xs text-surface-500">
                            {formatRelativeTime(latestDelivery.proofVideo.uploadedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirm Button */}
                  {isClient && latestDelivery.status === 'submitted' && (
                    <Button onClick={handleConfirmDelivery} className="w-full">
                      Confirm & Unlock Download
                    </Button>
                  )}
                </Card>
              ) : (
                <Card className="!p-8 text-center">
                  <p className="text-surface-500">No delivery submitted yet</p>
                  {isHelper && (
                    <p className="text-surface-600 text-sm mt-1">
                      Upload your project files and proof video to submit the delivery
                    </p>
                  )}
                </Card>
              )}

              {/* All Delivery Versions */}
              {deliveries.length > 1 && (
                <div>
                  <h3 className="text-sm font-medium text-surface-400 mb-3">All Versions</h3>
                  <div className="space-y-2">
                    {deliveries.slice(1).map((del) => (
                      <Card key={del.id} className="!p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm text-white">v{del.version}: {del.versionLabel}</span>
                            <span className="text-xs text-surface-500 ml-2">
                              {del.isRevision ? 'Revision' : 'Original'} · {formatRelativeTime(del.createdAt)}
                            </span>
                          </div>
                          <span className={`text-xs ${del.status === 'confirmed' ? 'text-emerald-400' : 'text-surface-500'}`}>
                            {del.status === 'confirmed' ? 'Confirmed' : del.status}
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Project Files</h2>

              {deliveries.length === 0 ? (
                <Card className="!p-8 text-center">
                  <p className="text-surface-500">No files uploaded yet</p>
                </Card>
              ) : (
                deliveries.map((del) => (
                  <Card key={del.id} className="!p-4">
                    <h3 className="text-white font-medium mb-3">v{del.version}: {del.versionLabel}</h3>
                    <div className="space-y-2">
                      {del.files.map((file) => (
                        <div key={file.id} className="flex items-center justify-between bg-surface-800/50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-surface-400">📄</span>
                            <div>
                              <span className="text-sm text-surface-200">{file.name}</span>
                              <p className="text-xs text-surface-500">{(file.size / 1024).toFixed(1)} KB</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDownload(file)}
                            disabled={!workspace.downloadEnabled && !isHelper}
                          >
                            {workspace.downloadEnabled || isHelper ? 'Download' : '🔒'}
                          </Button>
                        </div>
                      ))}
                    </div>
                    {del.proofVideo && (
                      <div className="mt-3 pt-3 border-t border-surface-800">
                        <p className="text-xs text-surface-400 mb-2">Proof Video</p>
                        <video
                          src={del.proofVideo.url}
                          controls
                          className="w-full max-h-48 rounded-lg"
                          preload="metadata"
                        />
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Task Info */}
          <Card className="!p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Task Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-surface-400">Status</span>
                <StatusBadge status={task.status} size="sm" />
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Bounty</span>
                <span className="text-primary-400">⚡ {formatCredits(task.creditBounty)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-400">Created</span>
                <span className="text-surface-300">{formatTimestamp(task.createdAt)}</span>
              </div>
              {task.deliveryConfirmedAt && (
                <div className="flex justify-between">
                  <span className="text-surface-400">Delivered</span>
                  <span className="text-emerald-400">{formatTimestamp(task.deliveryConfirmedAt)}</span>
                </div>
              )}
              {workspace.currentVersion > 0 && (
                <div className="flex justify-between">
                  <span className="text-surface-400">Version</span>
                  <span className="text-surface-300">v{workspace.currentVersion}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Actions */}
          <Card className="!p-4 space-y-2">
            <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>

            {isHelper && !workspace.deliveryConfirmed && task.status !== 'rework' && task.status !== 'disputed' && task.status !== 'completed' && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => setShowProgressModal(true)}
              >
                Post Progress Update
              </Button>
            )}

            <Link to={`/tasks/${task.id}`} className="block">
              <Button size="sm" variant="ghost" className="w-full">
                View Task Page
              </Button>
            </Link>

            {/* Raise Dispute */}
            {isClient && task.status !== 'disputed' && task.status !== 'completed' && task.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="danger"
                className="w-full"
                onClick={() => setShowDisputeModal(true)}
              >
                Raise Dispute
              </Button>
            )}
          </Card>
        </div>
      </div>

      {/* Progress Update Modal */}
      <Modal isOpen={showProgressModal} onClose={() => setShowProgressModal(false)} title="Post Progress Update">
        <div className="space-y-4">
          <Input
            label="Title"
            value={progressTitle}
            onChange={(e) => setProgressTitle(e.target.value)}
            placeholder="What have you accomplished?"
          />
          <TextArea
            label="Description"
            value={progressDesc}
            onChange={(e) => setProgressDesc(e.target.value)}
            rows={3}
            placeholder="Describe your progress in detail..."
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Status</label>
            <select
              value={progressStatus}
              onChange={(e) => setProgressStatus(e.target.value as ProgressStatus)}
              className="w-full bg-surface-800/50 border border-surface-700 text-white rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
            >
              <option value="planning">Planning</option>
              <option value="in_progress">In Progress</option>
              <option value="testing">Testing</option>
              <option value="fixing">Fixing</option>
              <option value="finalizing">Finalizing</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
          <Button onClick={handleAddProgress} className="w-full">Post Update</Button>
        </div>
      </Modal>

      {/* Delivery Modal */}
      <Modal isOpen={showDeliveryModal} onClose={() => setShowDeliveryModal(false)} title={task.status === 'rework' ? 'Upload Revised Project' : 'Submit Delivery'}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Input
            label="Version Label"
            value={versionLabel}
            onChange={(e) => setVersionLabel(e.target.value)}
            placeholder={task.status === 'rework' ? 'v2 - Fixed Issues' : 'v1 - Initial Release'}
          />
          <TextArea
            label="Delivery Notes"
            value={deliveryNotes}
            onChange={(e) => setDeliveryNotes(e.target.value)}
            rows={3}
            placeholder="Describe what you delivered, setup instructions, etc."
          />

          {task.status === 'rework' && (
            <>
              <TextArea
                label="What was changed"
                value={(deliveryNotes)}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                rows={2}
                placeholder="Describe what you fixed/changed in this revision..."
              />
            </>
          )}

          {/* File Upload */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">
              Project Files {uploadedFiles.length > 0 && <span className="text-emerald-400">({uploadedFiles.length} uploaded)</span>}
            </label>
            <div className="border-2 border-dashed border-surface-700 rounded-lg p-4 text-center hover:border-primary-500/50 transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const files = Array.from(e.dataTransfer.files);
                setUploading(true);
                for (const file of files) {
                  try {
                    const df = await handleFileUpload(file);
                    setUploadedFiles(prev => [...prev, df]);
                  } catch (err) {
                    toast.error(`Failed to upload ${file.name}`);
                  }
                }
                setUploading(false);
              }}
            >
              <input
                type="file"
                multiple
                className="hidden"
                id="file-upload"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  setUploading(true);
                  for (const file of files) {
                    try {
                      const df = await handleFileUpload(file);
                      setUploadedFiles(prev => [...prev, df]);
                    } catch (err) {
                      toast.error(`Failed to upload ${file.name}`);
                    }
                  }
                  setUploading(false);
                }}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                {uploading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                    <span className="text-sm text-surface-400">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-surface-400">Drop files here or click to browse</p>
                    <p className="text-xs text-surface-600 mt-1">ZIP, source code, documentation</p>
                  </>
                )}
              </label>
            </div>
            {uploadedFiles.map((f) => (
              <div key={f.id} className="flex items-center justify-between bg-surface-800/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-surface-300">{f.name}</span>
                <button
                  onClick={() => setUploadedFiles(prev => prev.filter(x => x.id !== f.id))}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Video Upload */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">
              Proof/Demo Video {proofVideo && <span className="text-emerald-400">✓ Uploaded</span>}
            </label>
            {proofVideo ? (
              <div className="bg-surface-800/50 rounded-lg overflow-hidden">
                <video src={proofVideo.url} controls className="w-full max-h-48" preload="metadata" />
                <div className="p-2 flex justify-between items-center">
                  <span className="text-xs text-surface-400">{proofVideo.name}</span>
                  <button
                    onClick={() => setProofVideo(null)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-surface-700 rounded-lg p-4 text-center cursor-pointer hover:border-primary-500/50 transition-colors">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  id="video-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploading(true);
                    try {
                      const pv = await handleVideoUpload(file);
                      setProofVideo(pv);
                    } catch (err) {
                      toast.error('Failed to upload video');
                    }
                    setUploading(false);
                  }}
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <p className="text-sm text-surface-400">Click to upload demo video</p>
                  <p className="text-xs text-surface-600 mt-1">Show the project running with main features</p>
                </label>
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-surface-300">Confirmation Checklist</label>
            <div className="bg-surface-800/30 rounded-lg p-3 space-y-2">
              {Object.entries(deliveryChecklist).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setDeliveryChecklist(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-4 h-4 rounded border-surface-600 bg-surface-800 text-primary-500 focus:ring-primary-500/50"
                  />
                  <span className="text-sm text-surface-300">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSubmitDelivery}
            className="w-full"
            disabled={uploading || uploadedFiles.length === 0 || !proofVideo}
          >
            {uploading ? 'Uploading...' : task.status === 'rework' ? 'Submit Revised Project' : 'Submit Delivery'}
          </Button>
        </div>
      </Modal>

      {/* Dispute Modal */}
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
      <Modal isOpen={showRatingModal} onClose={() => setShowRatingModal(false)} title="Rate This Project">
        <div className="space-y-4 text-center">
          <p className="text-surface-300 text-sm">
            {isClient ? 'How was your experience with this helper?' : 'How was your experience with this client?'}
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRatingScore(star)}
                className={`text-3xl transition-all hover:scale-110 ${
                  star <= ratingScore ? 'text-amber-400' : 'text-surface-600'
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <TextArea
            label="Review (optional)"
            value={ratingDesc}
            onChange={(e) => setRatingDesc(e.target.value)}
            rows={2}
            placeholder="Share your feedback..."
          />
          <Button onClick={handleSubmitRating} className="w-full">
            Submit Rating
          </Button>
        </div>
      </Modal>
    </motion.div>
  );
}
