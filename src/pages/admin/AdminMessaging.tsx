import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToAllUsers, sendAdminMessage } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input, { TextArea } from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import type { UserProfile } from '../../types';
import toast from 'react-hot-toast';

const BATCH_SIZE = 20; // Users per batch to avoid Firestore write limits

export default function AdminMessaging() {
  const { currentUser, userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    const unsub = subscribeToAllUsers((allUsers) => {
      setUsers(allUsers);
    });
    return unsub;
  }, []);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleSelectUser = (user: UserProfile) => {
    setSelectedUser(user);
    setShowPreview(false);
  };

  const handleSend = async () => {
    if (!selectedUser || !title.trim() || !message.trim() || !currentUser) return;
    setSending(true);
    try {
      await sendAdminMessage(
        selectedUser.uid,
        title.trim(),
        message.trim(),
        userProfile?.displayName || currentUser.displayName || 'Admin',
        currentUser.uid
      );
      toast.success(`Message sent to ${selectedUser.displayName}`);
      setTitle('');
      setMessage('');
      setSelectedUser(null);
      setSentCount((c) => c + 1);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
      setShowPreview(false);
    }
  };

  const handleSendToAll = async () => {
    if (!title.trim() || !message.trim() || !currentUser) return;
    setSending(true);
    setSendProgress({ current: 0, total: users.length });

    let successCount = 0;
    let failCount = 0;
    const adminName = userProfile?.displayName || currentUser.displayName || 'Admin';
    const adminId = currentUser.uid;
    const msgTitle = title.trim();
    const msgBody = message.trim();

    // Send in batches to avoid overwhelming Firestore
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) =>
          sendAdminMessage(user.uid, msgTitle, msgBody, adminName, adminId)
        )
      );
      results.forEach((r) => {
        if (r.status === 'fulfilled') successCount++;
        else failCount++;
      });
      setSendProgress({ current: Math.min(i + BATCH_SIZE, users.length), total: users.length });
    }

    setSending(false);
    setSendProgress({ current: 0, total: 0 });

    if (failCount > 0) {
      toast.success(`Message sent to ${successCount} users (${failCount} failed)`);
    } else {
      toast.success(`Message sent to all ${successCount} users!`);
    }
    setTitle('');
    setMessage('');
    setSentCount((c) => c + successCount);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Messaging</h1>
          <p className="text-sm text-surface-400 mt-1">
            Send announcements or notifications to users
            {sentCount > 0 && (
              <span className="ml-2 text-primary-400">
                · {sentCount} message{sentCount !== 1 ? 's' : ''} sent this session
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: User list */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="!p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Select Recipient</h2>
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Card>

          <Card className="!p-0 max-h-[60vh] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-surface-500 text-sm">No users found</div>
            ) : (
              <div className="divide-y divide-surface-800/50">
                {filteredUsers.slice(0, 50).map((user) => (
                  <button
                    key={user.uid}
                    onClick={() => handleSelectUser(user)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-800/30 ${
                      selectedUser?.uid === user.uid
                        ? 'bg-primary-500/10 border-l-2 border-primary-500'
                        : ''
                    }`}
                  >
                    <Avatar src={user.photoURL} name={user.displayName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {user.displayName}
                      </p>
                      <p className="text-xs text-surface-500 truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {user.isBlocked && (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                          Blocked
                        </span>
                      )}
                      {user.isAdmin && (
                        <span className="text-[10px] text-primary-400 bg-primary-500/10 px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Compose */}
        <div className="lg:col-span-3">
          <Card className="!p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              {selectedUser ? (
                <span>
                  Composing message for{' '}
                  <span className="text-primary-400">{selectedUser.displayName}</span>
                </span>
              ) : (
                'Select a user to compose a message'
              )}
            </h2>

            <div className="space-y-4">
              <Input
                label="Title"
                placeholder="e.g., Account Issue, Bug Found, Important Notice..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-surface-300">Message</label>
                <TextArea
                  placeholder="Write your message to the user..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="min-h-[160px]"
                />
                <p className="text-xs text-surface-500 text-right">
                  {message.length} characters
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button
                  disabled={!selectedUser || !title.trim() || !message.trim()}
                  onClick={() => setShowPreview(true)}
                >
                  Send to {selectedUser?.displayName || 'User'}
                </Button>

                <Button
                  variant="secondary"
                  disabled={!title.trim() || !message.trim() || users.length === 0 || sending}
                  loading={sending}
                  onClick={handleSendToAll}
                >
                  {sending
                    ? `Sending... (${sendProgress.current}/${sendProgress.total})`
                    : `Send to All Users (${users.length})`}
                </Button>
              </div>

              {selectedUser && (
                <div className="mt-4 p-3 rounded-lg bg-surface-800/40 border border-surface-700/50">
                  <p className="text-xs text-surface-400">
                    <span className="text-primary-400 font-medium">Tip:</span> The user will
                    receive this as a notification in their bell icon. Use clear titles so they
                    know the urgency.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Preview & Confirm Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Confirm Message"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-surface-800/40 border border-surface-700/50">
            <div className="flex items-center gap-3 mb-3">
              {selectedUser && (
                <Avatar src={selectedUser.photoURL} name={selectedUser.displayName} size="sm" />
              )}
              <div>
                <p className="text-sm text-white font-medium">
                  To: {selectedUser?.displayName}
                </p>
                <p className="text-xs text-surface-400">{selectedUser?.email}</p>
              </div>
            </div>
            <div className="border-t border-surface-700/50 pt-3 mt-3">
              <p className="text-sm font-semibold text-white mb-2">{title}</p>
              <p className="text-sm text-surface-300 whitespace-pre-wrap">{message}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSend} loading={sending} className="flex-1">
              Send Message
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowPreview(false)}
              className="flex-1"
            >
              Edit
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
