import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToAllUsers, adminBlockUser, adminAdjustCredits } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { formatCredits } from '../../lib/utils';
import type { UserProfile } from '../../types';
import toast from 'react-hot-toast';

export default function AdminUsers() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  useEffect(() => {
    const unsub = subscribeToAllUsers(setUsers);
    return unsub;
  }, []);

  const filteredUsers = users.filter(u => 
    u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleBlock = async (userId: string, block: boolean) => {
    if (!currentUser) return;
    try {
      await adminBlockUser(userId, currentUser.uid, block);
      toast.success(block ? 'User blocked' : 'User unblocked');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAdjustCredits = async () => {
    if (!currentUser || !selectedUser) return;
    const amount = parseInt(adjustAmount);
    if (!amount) return;
    try {
      await adminAdjustCredits(selectedUser.uid, amount, currentUser.uid, adjustReason);
      toast.success(`Credits adjusted by ${amount}`);
      setSelectedUser(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h1 className="text-2xl font-bold text-white mb-6">User Management</h1>

      <Input
        placeholder="Search users by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4"
      />

      <div className="space-y-2">
        {filteredUsers.map((user) => (
          <Card key={user.uid} className="!p-4">
            <div className="flex items-center gap-3">
              <Avatar src={user.photoURL} name={user.displayName} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{user.displayName}</p>
                <p className="text-xs text-surface-400">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-primary-400">⚡ {formatCredits(user.credits)}</span>
                  <span className="text-xs text-surface-500">{user.role}</span>
                  {user.isAdmin && <span className="text-xs bg-primary-500/10 text-primary-400 px-1.5 py-0.5 rounded">Admin</span>}
                  {user.isBlocked && <span className="text-xs bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Blocked</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelectedUser(user)}>
                  Adjust Credits
                </Button>
                <Button
                  size="sm"
                  variant={user.isBlocked ? 'secondary' : 'danger'}
                  onClick={() => handleBlock(user.uid, !user.isBlocked)}
                >
                  {user.isBlocked ? 'Unblock' : 'Block'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {filteredUsers.length === 0 && (
          <p className="text-center text-surface-500 py-8">No users found</p>
        )}
      </div>

      <Modal isOpen={!!selectedUser} onClose={() => setSelectedUser(null)} title="Adjust Credits">
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            Adjusting credits for <strong className="text-white">{selectedUser?.displayName}</strong>
          </p>
          <Input
            label="Amount (positive to add, negative to remove)"
            type="number"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
          />
          <Input
            label="Reason"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          />
          <Button onClick={handleAdjustCredits} className="w-full">Apply Adjustment</Button>
        </div>
      </Modal>
    </motion.div>
  );
}
