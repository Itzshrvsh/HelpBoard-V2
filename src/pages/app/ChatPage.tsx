import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToMessages, sendMessage, getUserProfile } from '../../lib/firebaseServices';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { formatRelativeTime } from '../../lib/utils';
import type { Chat, Message, UserProfile } from '../../types';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const { chatId } = useParams();
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeToMessages(chatId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [chatId]);

  useEffect(() => {
    if (!chatId || !currentUser) return;
    const loadChat = async () => {
      // Get chat info from messages or a direct lookup
      const { getDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const snap = await getDoc(doc(db, 'chats', chatId));
      if (snap.exists()) {
        const chatData = snap.data() as Chat;
        setChat(chatData);
        const otherId = chatData.clientId === currentUser.uid ? chatData.helperId : chatData.clientId;
        const profile = await getUserProfile(otherId);
        setOtherUser(profile);
      }
    };
    loadChat();
  }, [chatId, currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatId || !input.trim()) return;
    try {
      await sendMessage(chatId, input.trim());
      setInput('');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId) return;
    
    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
      toast.error('Invalid file type. Please upload images or PDFs.');
      e.target.value = '';
      return;
    }
    
    if (file.size > maxSize) {
      toast.error('File is too large. Maximum size is 10MB.');
      e.target.value = '';
      return;
    }
    
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../../lib/firebase');
      
      const storageRef = ref(storage, `chat-proofs/${chatId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      await sendMessage(chatId, `[Proof of skill]: ${file.name}`, 'skill_proof', url, file.name);
      toast.success('Proof uploaded!');
    } catch (err: any) {
      toast.error('Failed to upload file');
    }
    
    e.target.value = '';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto"
    >
      <Link to="/dashboard" className="text-sm text-surface-400 hover:text-white transition-colors mb-4 inline-block">
        ← Back
      </Link>

      <Card className="!p-0 overflow-hidden">
        {/* Chat Header */}
        {otherUser && (
          <div className="p-4 border-b border-surface-800/50 flex items-center gap-3">
            <Avatar src={otherUser.photoURL} name={otherUser.displayName} uid={otherUser.uid} size="md" />
            <div>
              <Link to={`/profile/${otherUser.uid}`} className="font-medium text-white hover:text-primary-400 transition-colors">
                {otherUser.displayName}
              </Link>
              <p className="text-xs text-surface-400">{otherUser.skills?.slice(0, 3).join(', ') || ''}</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="h-[60vh] overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-surface-500 text-sm">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === currentUser?.uid;
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${isMine ? 'order-1' : 'order-1'}`}>
                    <div className="flex items-end gap-2">
                      {!isMine && (
                        <Avatar src={msg.senderPhotoURL} name={msg.senderName} size="sm" />
                      )}
                      <div
                        className={`rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'bg-primary-600 text-white rounded-br-md'
                            : 'bg-surface-800 text-surface-200 rounded-bl-md'
                        }`}
                      >
                        {msg.type === 'skill_proof' && msg.proofUrl ? (
                          <div className="space-y-2">
                            <p className="text-xs text-primary-300 font-medium">📎 Proof of Skill</p>
                            <p className="text-sm">{msg.content}</p>
                            {msg.proofUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <img src={msg.proofUrl} alt="Proof" className="rounded-lg max-w-full max-h-48 object-cover" />
                            ) : (
                              <a
                                href={msg.proofUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary-300 hover:text-primary-200 underline break-all"
                              >
                                {msg.proofDescription || 'View attachment'}
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className={`text-xs mt-1 ${isMine ? 'text-primary-200' : 'text-surface-500'}`}>
                          {formatRelativeTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-4 border-t border-surface-800/50">
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all"
              title="Attach proof of skill"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-surface-800/50 border border-surface-700 text-white placeholder-surface-500 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-sm"
              maxLength={2000}
            />
            <Button type="submit" size="md" disabled={!input.trim()}>
              Send
            </Button>
          </div>
        </form>
      </Card>
    </motion.div>
  );
}
