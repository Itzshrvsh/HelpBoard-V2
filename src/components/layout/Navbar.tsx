import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import Avatar from '../ui/Avatar';
import Button from '../ui/Button';
import NotificationBell from '../ui/NotificationBell';
import { logOut } from '../../lib/firebaseServices';

export default function Navbar() {
  const { currentUser, userProfile, role, setRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logOut();
    navigate('/');
  };

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return null;

  const navLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: '📊' },
    { to: role === 'client' ? '/post-task' : '/browse', label: role === 'client' ? 'Post Task' : 'Browse', icon: role === 'client' ? '📝' : '🔍' },
    { to: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
    { to: '/credits', label: 'Credits', icon: '💎' },
  ];

  return (
    <nav className="sticky top-0 z-40 glass border-b border-surface-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HB</span>
            </div>
            <span className="text-lg font-bold text-white hidden sm:block">
              Help<span className="text-primary-500">Board</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          {currentUser && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    location.pathname === link.to
                      ? 'bg-primary-600/10 text-primary-400'
                      : 'text-surface-300 hover:text-white hover:bg-surface-800/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          {currentUser ? (
            <div className="flex items-center gap-3">
              {/* Role Switcher */}
              <div className="hidden sm:flex items-center bg-surface-800/50 rounded-lg p-0.5 border border-surface-700/50">
                <button
                  onClick={() => setRole('client')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    role === 'client'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  Client
                </button>
                <button
                  onClick={() => setRole('helper')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                    role === 'helper'
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-surface-400 hover:text-white'
                  }`}
                >
                  Helper
                </button>
              </div>

              {/* Notification Bell */}
              {currentUser && <NotificationBell userId={currentUser.uid} />}

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-800/50 transition-colors"
                >
                  <Avatar src={userProfile?.photoURL} name={userProfile?.displayName || 'User'} size="sm" />
                  <span className="text-sm text-surface-300 hidden lg:block">
                    {userProfile?.displayName}
                  </span>
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 glass rounded-xl border border-surface-700/50 shadow-2xl overflow-hidden"
                    >
                      <div className="p-3 border-b border-surface-800">
                        <p className="text-sm font-medium text-white">{userProfile?.displayName}</p>
                        <p className="text-xs text-surface-400">{userProfile?.email}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-xs text-primary-400 font-mono">⚡ {userProfile?.credits || 0}</span>
                          <span className="text-xs text-surface-500">credits</span>
                        </div>
                      </div>
                      <div className="p-1.5">
                        <Link to={`/profile/${currentUser.uid}`} className="block px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg" onClick={() => setMenuOpen(false)}>
                          My Profile
                        </Link>
                        <Link to="/transactions" className="block px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg" onClick={() => setMenuOpen(false)}>
                          Transactions
                        </Link>
                        <Link to="/chats" className="block px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg" onClick={() => setMenuOpen(false)}>
                          Messages
                        </Link>
                        <hr className="my-1 border-surface-800" />
                        <Link to="/buy-credits" className="block px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg" onClick={() => setMenuOpen(false)}>
                          Buy Credits
                        </Link>
                        <Link to="/withdraw" className="block px-3 py-2 text-sm text-surface-300 hover:text-white hover:bg-surface-800 rounded-lg" onClick={() => setMenuOpen(false)}>
                          Withdraw
                        </Link>
                      </div>
                      <div className="p-1.5 border-t border-surface-800">
                        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          Sign Out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Nav */}
        {currentUser && (
          <div className="md:hidden flex items-center gap-1 pb-3 overflow-x-auto">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  location.pathname === link.to
                    ? 'bg-primary-600/10 text-primary-400'
                    : 'text-surface-400 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={() => setRole(role === 'client' ? 'helper' : 'client')}
              className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-800 text-surface-300"
            >
              Switch to {role === 'client' ? 'Helper' : 'Client'}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
