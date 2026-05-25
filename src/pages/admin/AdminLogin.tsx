import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { logIn, getUserProfile } from '../../lib/firebaseServices';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import toast from 'react-hot-toast';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign out any existing user first
      if (auth.currentUser) {
        await signOut(auth);
      }
      
      const user = await logIn(email, password);
      const profile = await getUserProfile(user.uid);
      if (!profile?.isAdmin) {
        toast.error('Access denied. Admin only.');
        await signOut(auth);
        navigate('/');
        return;
      }
      toast.success('Welcome to Admin Panel');
      navigate('/admin');
    } catch (err: any) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-surface-800/50">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-lg">HB</span>
            </div>
            <h1 className="text-xl font-bold text-white">Admin Panel</h1>
            <p className="text-surface-400 text-sm mt-1">Authorized access only</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Admin Email" type="email" placeholder="admin@helpboard.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Input label="Password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">Sign In to Admin</Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
