import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscribeToAdminLogs, subscribeToAllUsers, subscribeToAllTransactions, subscribeToTasks } from '../../lib/firebaseServices';
import { getLogFolderStructure, listLogFolder, logFullPlatformSnapshot, getPaymentProofs, getWithdrawalQrs, getLogStats } from '../../lib/loggingService';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { formatTimestamp } from '../../lib/utils';
import type { AdminLog, UserProfile, Task, Transaction } from '../../types';

type Tab = 'firestore' | 'storage';

interface LogFolderStructure {
  users: string[];
  tasks: string[];
  transactions: string[];
  disputes: string[];
  snapshots: string[];
  adminActions: number;
  paymentProofs: number;
  withdrawalQrs: number;
}

interface LogFileItem {
  id: string;
  name: string;
  logType: string;
  category: string;
  relatedId: string;
  data: any;
  imageData?: string;
  createdAt: string | null;
}

type BrowseView = 'root' | 'users' | 'tasks' | 'payment_proofs' | 'withdrawal_qrs' | 'files';

export default function AdminLogs() {
  const [tab, setTab] = useState<Tab>('firestore');

  // Firestore logs
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [filter, setFilter] = useState('');

  // Storage logs
  const [folderStructure, setFolderStructure] = useState<LogFolderStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseView, setBrowseView] = useState<BrowseView>('root');
  const [currentFolder, setCurrentFolder] = useState('');
  const [currentFiles, setCurrentFiles] = useState<LogFileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<LogFileItem | null>(null);
  const [paymentProofs, setPaymentProofs] = useState<LogFileItem[]>([]);
  const [withdrawalQrs, setWithdrawalQrs] = useState<LogFileItem[]>([]);
  const [snapshotting, setSnapshotting] = useState(false);
  const [error, setError] = useState('');
  const [logStats, setLogStats] = useState<{ count: number; sizeKB: number } | null>(null);

  useEffect(() => {
    const unsub = subscribeToAdminLogs(setLogs);
    return unsub;
  }, []);

  const fetchStructure = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [structure, stats] = await Promise.all([
        getLogFolderStructure(),
        Promise.resolve(getLogStats()),
      ]);
      setFolderStructure(structure);
      setLogStats(stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load log structure');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleBrowseFolder = async (category: string, relatedId?: string) => {
    setLoading(true);
    setError('');
    try {
      // Build a path that parsePath in loggingService can understand
      const folderPath = category === 'snapshots'
        ? `logs/${category}`
        : `logs/data/${category}${relatedId ? `/${relatedId}` : ''}`;
      const items = await listLogFolder(folderPath);
      setCurrentFiles(items);
      setCurrentFolder(category);
      setBrowseView('files');
    } catch (err: any) {
      setError(err.message || 'Failed to list folder');
    } finally {
      setLoading(false);
    }
  };

  const handleViewFile = (file: LogFileItem) => {
    setSelectedFile(file);
  };

  const handleTakeSnapshot = async () => {
    setSnapshotting(true);
    setError('');
    try {
      const [usersSnap, tasksSnap, transactionsSnap] = await Promise.all([
        new Promise<UserProfile[]>((resolve) => {
          const unsub = subscribeToAllUsers((users) => {
            unsub();
            resolve(users);
          });
        }),
        new Promise<Task[]>((resolve) => {
          const unsub = subscribeToTasks((tasks) => {
            unsub();
            resolve(tasks);
          });
        }),
        new Promise<Transaction[]>((resolve) => {
          const unsub = subscribeToAllTransactions((txns) => {
            unsub();
            resolve(txns);
          });
        }),
      ]);

      await logFullPlatformSnapshot(usersSnap, tasksSnap, transactionsSnap, null);
      await fetchStructure();
    } catch (err: any) {
      setError(err.message || 'Failed to take snapshot');
    } finally {
      setSnapshotting(false);
    }
  };

  const handleBrowsePaymentProofs = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await getPaymentProofs();
      setPaymentProofs(items);
      setBrowseView('payment_proofs');
    } catch (err: any) {
      setError(err.message || 'Failed to load payment proofs');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseWithdrawalQrs = async () => {
    setLoading(true);
    setError('');
    try {
      const items = await getWithdrawalQrs();
      setWithdrawalQrs(items);
      setBrowseView('withdrawal_qrs');
    } catch (err: any) {
      setError(err.message || 'Failed to load withdrawal QR codes');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToRoot = () => {
    setBrowseView('root');
    setCurrentFolder('');
    setCurrentFiles([]);
    setPaymentProofs([]);
    setWithdrawalQrs([]);
    setSelectedFile(null);
  };

  const downloadFile = (file: LogFileItem) => {
    const isImage = file.logType === 'payment_proof' || file.logType === 'withdrawal_qr';
    if (isImage && file.imageData) {
      const a = document.createElement('a');
      a.href = file.imageData;
      a.download = file.name;
      a.click();
    } else {
      const jsonStr = JSON.stringify(file.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const filtered = filter
    ? logs.filter((l) => l.action.includes(filter) || l.targetType.includes(filter))
    : logs;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Logs</h1>

        <div className="flex gap-1 bg-surface-800 rounded-lg p-1">
          <button
            onClick={() => setTab('firestore')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'firestore' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'
            }`}
          >
            Firestore Logs
          </button>
          <button
            onClick={() => { setTab('storage'); fetchStructure(); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === 'storage' ? 'bg-primary-600 text-white' : 'text-surface-400 hover:text-white'
            }`}
          >
            Log Archives
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-200">✕</button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {tab === 'firestore' ? (
          <motion.div
            key="firestore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {['', 'user', 'payment', 'withdrawal', 'setting', 'dispute'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    filter === f ? 'bg-primary-600 text-white' : 'bg-surface-800 text-surface-400 hover:text-white'
                  }`}
                >
                  {f || 'All'}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.map((log) => (
                <Card key={log.id} className="!p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-white">{log.action.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-surface-400">
                        Target: {log.targetType} ({log.targetId})
                      </p>
                      {log.reason && <p className="text-xs text-surface-500">Reason: {log.reason}</p>}
                      {log.oldValue && log.newValue && (
                        <p className="text-xs text-surface-500">
                          {log.oldValue} → {log.newValue}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-surface-400">{formatTimestamp(log.createdAt)}</p>
                      <p className="text-xs text-surface-500">by admin</p>
                    </div>
                  </div>
                </Card>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-surface-500 text-center py-8">No logs found</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="storage"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex gap-3 mb-6">
              <Button
                variant="primary"
                disabled={snapshotting}
                onClick={handleTakeSnapshot}
              >
                {snapshotting ? 'Taking Snapshot...' : '📸 Take Platform Snapshot'}
              </Button>
              {browseView !== 'root' && (
                <Button variant="secondary" onClick={handleBackToRoot}>
                  ← Back to Overview
                </Button>
              )}
            </div>

            {loading && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-surface-400">Loading logs...</span>
              </div>
            )}

            {!loading && browseView === 'root' && folderStructure && (
              <div className="space-y-4">
                {/* SQLite/IndexedDB stats banner */}
                {logStats && (
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-surface-800/60 border border-surface-700/50 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-surface-400">🗄️</span>
                      <span className="text-surface-400">local.db (SQLite):</span>
                    </div>
                    <span className="text-white font-medium">{logStats.count} entries</span>
                    <span className="text-surface-500">·</span>
                    <span className="text-surface-300">{logStats.sizeKB} KB</span>
                    <span className="text-surface-500 text-[10px]">
                      (via IndexedDB — essentially unlimited)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.users.length}</p>
                    <p className="text-xs text-surface-500 mt-1">Users Logged</p>
                  </Card>
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.tasks.length}</p>
                    <p className="text-xs text-surface-500 mt-1">Tasks Logged</p>
                  </Card>
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.transactions.length}</p>
                    <p className="text-xs text-surface-500 mt-1">Transactions Logged</p>
                  </Card>
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.disputes.length}</p>
                    <p className="text-xs text-surface-500 mt-1">Disputes Logged</p>
                  </Card>
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.adminActions}</p>
                    <p className="text-xs text-surface-500 mt-1">Admin Actions</p>
                  </Card>
                  <Card className="!p-4 text-center">
                    <p className="text-2xl font-bold text-primary-400">{folderStructure.snapshots.length}</p>
                    <p className="text-xs text-surface-500 mt-1">Snapshots</p>
                  </Card>
                  <Card className="!p-4 text-center cursor-pointer hover:bg-surface-750 transition-colors" onClick={handleBrowsePaymentProofs}>
                    <p className="text-2xl font-bold text-green-400">{folderStructure.paymentProofs}</p>
                    <p className="text-xs text-surface-500 mt-1">Payment Proofs 💳</p>
                  </Card>
                  <Card className="!p-4 text-center cursor-pointer hover:bg-surface-750 transition-colors" onClick={handleBrowseWithdrawalQrs}>
                    <p className="text-2xl font-bold text-purple-400">{folderStructure.withdrawalQrs}</p>
                    <p className="text-xs text-surface-500 mt-1">Withdrawal QRs 📱</p>
                  </Card>
                </div>

                <h3 className="text-sm font-semibold text-white mt-6 mb-3">Browse Logs</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {folderStructure.users.length > 0 && (
                    <Card className="!p-4 cursor-pointer hover:bg-surface-750 transition-colors" onClick={() => setBrowseView('users')}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">👤</span>
                        <div>
                          <p className="text-sm font-medium text-white">Users</p>
                          <p className="text-xs text-surface-500">{folderStructure.users.length} users with logs</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {folderStructure.tasks.length > 0 && (
                    <Card className="!p-4 cursor-pointer hover:bg-surface-750 transition-colors" onClick={() => setBrowseView('tasks')}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📋</span>
                        <div>
                          <p className="text-sm font-medium text-white">Tasks</p>
                          <p className="text-xs text-surface-500">{folderStructure.tasks.length} tasks with logs</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {folderStructure.adminActions > 0 && (
                    <Card className="!p-4 cursor-pointer hover:bg-surface-750 transition-colors" onClick={() => handleBrowseFolder('admin_actions')}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">⚙️</span>
                        <div>
                          <p className="text-sm font-medium text-white">Admin Actions</p>
                          <p className="text-xs text-surface-500">{folderStructure.adminActions} entries</p>
                        </div>
                      </div>
                    </Card>
                  )}
                  {folderStructure.snapshots.length > 0 && (
                    <Card className="!p-4 cursor-pointer hover:bg-surface-750 transition-colors" onClick={() => handleBrowseFolder('snapshots')}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg">📸</span>
                        <div>
                          <p className="text-sm font-medium text-white">Snapshots</p>
                          <p className="text-xs text-surface-500">{folderStructure.snapshots.length} snapshots</p>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {!loading && browseView === 'users' && folderStructure && (
              <div>
                <button onClick={() => setBrowseView('root')} className="text-xs text-primary-400 hover:text-primary-300 mb-3">
                  ← Back
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {folderStructure.users.map((uid) => (
                    <button
                      key={uid}
                      onClick={() => handleBrowseFolder('users', uid)}
                      className="text-left px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs text-surface-300 truncate transition-colors"
                    >
                      👤 {uid.slice(0, 12)}...
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && browseView === 'tasks' && folderStructure && (
              <div>
                <button onClick={() => setBrowseView('root')} className="text-xs text-primary-400 hover:text-primary-300 mb-3">
                  ← Back
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {folderStructure.tasks.map((tid) => (
                    <button
                      key={tid}
                      onClick={() => handleBrowseFolder('tasks', tid)}
                      className="text-left px-3 py-2 rounded-lg bg-surface-800 hover:bg-surface-700 text-xs text-surface-300 truncate transition-colors"
                    >
                      📋 {tid.slice(0, 12)}...
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!loading && browseView === 'payment_proofs' && (
              <div>
                <button onClick={() => setBrowseView('root')} className="text-xs text-primary-400 hover:text-primary-300 mb-3">
                  ← Back
                </button>
                <p className="text-xs text-surface-500 mb-4">
                  💳 Payment Proofs — {paymentProofs.length} entries
                </p>

                {paymentProofs.length === 0 ? (
                  <p className="text-sm text-surface-500 text-center py-8">No payment proofs found</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paymentProofs.map((proof) => (
                      <Card key={proof.id} className="!p-0 overflow-hidden">
                        {/* Image thumbnail */}
                        <div
                          className="relative aspect-video bg-surface-900 cursor-pointer group"
                          onClick={() => handleViewFile(proof)}
                        >
                          {proof.imageData ? (
                            <img
                              src={proof.imageData}
                              alt="Payment Proof"
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-surface-500 text-sm">
                              No image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to view full size
                            </span>
                          </div>
                        </div>
                        {/* Metadata */}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-green-400">
                              ⚡ {proof.data?.amount ?? '?'} credits
                            </span>
                            <span className="text-xs text-surface-500">
                              {proof.data?.paymentMethod}
                            </span>
                          </div>
                          <p className="text-xs text-surface-400 truncate" title={proof.data?.userEmail}>
                            📧 {proof.data?.userEmail || 'No email'}
                          </p>
                          <p className="text-xs text-surface-500">
                            🆔 {proof.data?.requestId?.slice(0, 12)}...
                          </p>
                          {proof.createdAt && (
                            <p className="text-xs text-surface-600">
                              {formatTimestamp(proof.createdAt)}
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleViewFile(proof)}
                              className="flex-1 text-xs py-1.5 rounded bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                            >
                              View Full
                            </button>
                            <button
                              onClick={() => downloadFile(proof)}
                              className="text-xs py-1.5 px-2 rounded bg-surface-700 text-surface-300 hover:text-white transition-colors"
                            >
                              ⬇
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && browseView === 'withdrawal_qrs' && (
              <div>
                <button onClick={() => setBrowseView('root')} className="text-xs text-primary-400 hover:text-primary-300 mb-3">
                  ← Back
                </button>
                <p className="text-xs text-surface-500 mb-4">
                  📱 Withdrawal QR Codes — {withdrawalQrs.length} entries
                </p>

                {withdrawalQrs.length === 0 ? (
                  <p className="text-sm text-surface-500 text-center py-8">No withdrawal QR codes found</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {withdrawalQrs.map((qr) => (
                      <Card key={qr.id} className="!p-0 overflow-hidden">
                        {/* Image thumbnail */}
                        <div
                          className="relative aspect-video bg-surface-900 cursor-pointer group"
                          onClick={() => handleViewFile(qr)}
                        >
                          {qr.imageData ? (
                            <img
                              src={qr.imageData}
                              alt="Withdrawal QR"
                              className="w-full h-full object-contain p-2"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-surface-500 text-sm">
                              No image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <span className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                              Click to view full size
                            </span>
                          </div>
                        </div>
                        {/* Metadata */}
                        <div className="p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-purple-400">
                              ⚡ {qr.data?.amount ?? '?'} credits
                            </span>
                            <span className="text-xs text-surface-500">
                              💳 Withdrawal
                            </span>
                          </div>
                          <p className="text-xs text-surface-400 truncate" title={qr.data?.userEmail}>
                            📧 {qr.data?.userEmail || 'No email'}
                          </p>
                          <p className="text-xs text-surface-400 truncate" title={qr.data?.paymentDetails}>
                            🏦 {qr.data?.paymentDetails || 'No payment details'}
                          </p>
                          <p className="text-xs text-surface-500">
                            🆔 {qr.data?.requestId?.slice(0, 12)}...
                          </p>
                          {qr.createdAt && (
                            <p className="text-xs text-surface-600">
                              {formatTimestamp(qr.createdAt)}
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleViewFile(qr)}
                              className="flex-1 text-xs py-1.5 rounded bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
                            >
                              View Full
                            </button>
                            <button
                              onClick={() => downloadFile(qr)}
                              className="text-xs py-1.5 px-2 rounded bg-surface-700 text-surface-300 hover:text-white transition-colors"
                            >
                              ⬇
                            </button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && browseView === 'files' && (
              <div>
                <button onClick={handleBackToRoot} className="text-xs text-primary-400 hover:text-primary-300 mb-3">
                  ← Back to Overview
                </button>
                <p className="text-xs text-surface-500 mb-4">Category: {currentFolder}</p>

                {currentFiles.length === 0 ? (
                  <p className="text-sm text-surface-500 text-center py-8">No log entries in this folder</p>
                ) : (
                  <div className="space-y-2">
                    {currentFiles.map((file) => {
                      const isImage = file.logType === 'payment_proof' || file.logType === 'withdrawal_qr';
                      return (
                        <Card key={file.id} className="!p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span>{isImage ? '🖼️' : '📄'}</span>
                              <span className="text-sm text-surface-300 truncate">{file.name}</span>
                              {file.createdAt && (
                                <span className="text-xs text-surface-500 shrink-0">
                                  {formatTimestamp(file.createdAt)}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <button
                                onClick={() => handleViewFile(file)}
                                className="text-xs px-2 py-1 rounded bg-surface-700 text-primary-400 hover:text-primary-300"
                              >
                                View
                              </button>
                              <button
                                onClick={() => downloadFile(file)}
                                className="text-xs px-2 py-1 rounded bg-surface-700 text-surface-300 hover:text-white"
                              >
                                Download
                              </button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File viewer modal */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSelectedFile(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-surface-800 rounded-xl p-6 max-w-3xl w-full max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white truncate">{selectedFile.name}</h3>
                <button onClick={() => setSelectedFile(null)} className="text-surface-400 hover:text-white text-lg">
                  ✕
                </button>
              </div>

              {selectedFile.logType === 'payment_proof' || selectedFile.logType === 'withdrawal_qr' ? (
                <div className="space-y-4">
                  {/* Image */}
                  {selectedFile.imageData ? (
                    <img src={selectedFile.imageData} alt={selectedFile.name} className="max-w-full max-h-[50vh] rounded-lg mx-auto" />
                  ) : (
                    <div className="text-sm text-surface-400 text-center py-8">No image data available</div>
                  )}
                  {/* Payment/Withdrawal Details */}
                  {selectedFile.data && (
                    <div className="bg-surface-900 rounded-lg p-4 space-y-2">
                      <h4 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                        {selectedFile.logType === 'payment_proof' ? '💳 Payment Details' : '📱 Withdrawal Details'}
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-surface-500 text-xs">Amount</span>
                          <p className="text-white font-semibold">⚡ {selectedFile.data.amount ?? '?'} credits</p>
                        </div>
                        <div>
                          <span className="text-surface-500 text-xs">
                            {selectedFile.logType === 'payment_proof' ? 'Method' : 'Payment Details'}
                          </span>
                          <p className="text-surface-300 truncate" title={selectedFile.data.paymentMethod || selectedFile.data.paymentDetails}>
                            {selectedFile.data.paymentMethod || selectedFile.data.paymentDetails || '—'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-surface-500 text-xs">Email</span>
                          <p className="text-surface-300">{selectedFile.data.userEmail || '—'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-surface-500 text-xs">Request ID</span>
                          <p className="text-surface-400 text-xs font-mono">{selectedFile.data.requestId || '—'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-surface-500 text-xs">Timestamp</span>
                          <p className="text-surface-400 text-xs">{selectedFile.data.timestamp || '—'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <pre className="w-full max-h-[60vh] overflow-auto rounded-lg bg-surface-900 p-4 text-xs text-surface-300 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(selectedFile.data, null, 2)}
                </pre>
              )}

              <div className="mt-4 flex justify-end gap-2">
                {selectedFile.logType === 'payment_proof' || selectedFile.logType === 'withdrawal_qr' ? (
                  selectedFile.imageData && (
                    <a
                      href={selectedFile.imageData}
                      download={selectedFile.name}
                      className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500"
                    >
                      Download {selectedFile.name}
                    </a>
                  )
                ) : (
                  <button
                    onClick={() => downloadFile(selectedFile)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500"
                  >
                    Download JSON
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
