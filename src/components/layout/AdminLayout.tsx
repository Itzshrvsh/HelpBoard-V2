import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { logOut } from '../../lib/firebaseServices';

const sidebarLinks = [
  { to: '/admin', label: 'Dashboard', icon: '📊' },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/payments', label: 'Payments', icon: '💳' },
  { to: '/admin/withdrawals', label: 'Withdrawals', icon: '💰' },
  { to: '/admin/disputes', label: 'Disputes', icon: '⚖️' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
  { to: '/admin/logs', label: 'Logs', icon: '📋' },
];

export default function AdminLayout() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logOut();
    navigate('/admin/login');
  };

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Sidebar */}
      <motion.aside
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-64 glass border-r border-surface-800/50 flex flex-col flex-shrink-0"
      >
        <div className="p-5 border-b border-surface-800/50">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HB</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white">Admin</span>
              <span className="block text-xs text-primary-400">Panel</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === link.to
                  ? 'bg-primary-600/10 text-primary-400 border border-primary-500/20'
                  : 'text-surface-400 hover:text-white hover:bg-surface-800/50'
              }`}
            >
              <span>{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-surface-800/50">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center text-xs text-primary-400 font-medium">
              {userProfile?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{userProfile?.displayName}</p>
              <p className="text-xs text-surface-400">Admin</p>
            </div>
          </div>
          <Link to="/dashboard" className="block w-full text-left px-3 py-2 text-xs text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-colors mb-1">
            ← Back to Site
          </Link>
          <button onClick={handleLogout} className="block w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            Sign Out
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
