import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToChats, getUserProfile } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Card from '../../components/ui/Card';
import { formatRelativeTime, truncate } from '../../lib/utils';
import type { Chat, UserProfile } from '../../types';

export default function ChatList() {
  const { currentUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [otherUsers, setOtherUsers] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeToChats(currentUser.uid, async (chatList) => {
      setChats(chatList);
      setLoading(false);
      // Load other user profiles
      const profiles: Record<string, UserProfile> = {};
      for (const chat of chatList) {
        const otherId = chat.clientId === currentUser.uid ? chat.helperId : chat.clientId;
        if (!profiles[otherId]) {
          const profile = await getUserProfile(otherId);
          if (profile) profiles[otherId] = profile;
        }
      }
      setOtherUsers(profiles);
    });
    return unsub;
  }, [currentUser]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto"
    >
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : chats.length === 0 ? (
        <Card className="text-center !p-12">
          <p className="text-surface-400">No conversations yet</p>
          <p className="text-surface-500 text-sm mt-2">Claim a task to start chatting with clients</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {chats.map((chat) => {
            const otherId = chat.clientId === currentUser?.uid ? chat.helperId : chat.clientId;
            const otherUser = otherUsers[otherId];
            return (
              <Link key={chat.id} to={`/chats/${chat.id}`}>
                <Card className="!p-4 flex items-center gap-3">
                  <Avatar
                    src={otherUser?.photoURL}
                    name={otherUser?.displayName || 'Unknown'}
                    uid={otherId}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {otherUser?.displayName || 'Unknown User'}
                    </p>
                    <p className="text-xs text-surface-400 truncate">
                      {truncate(chat.lastMessage, 50)}
                    </p>
                  </div>
                  <div className="text-xs text-surface-500 flex-shrink-0">
                    {formatRelativeTime(chat.lastMessageTime)}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
