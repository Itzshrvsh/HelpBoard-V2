import React from 'react';
import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import AdminLayout from './components/layout/AdminLayout';
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from './components/layout/ProtectedRoute';

// Public pages
import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Signup from './pages/public/Signup';
import Blocked from './pages/public/Blocked';

// App pages
import Dashboard from './pages/app/Dashboard';
import PostTask from './pages/app/PostTask';
import Browse from './pages/app/Browse';
import TaskDetail from './pages/app/TaskDetail';
import ChatList from './pages/app/ChatList';
import ChatPage from './pages/app/ChatPage';
import Profile from './pages/app/Profile';
import LeaderboardPage from './pages/app/LeaderboardPage';
import Credits from './pages/app/Credits';
import BuyCredits from './pages/app/BuyCredits';
import Withdraw from './pages/app/Withdraw';
import Transactions from './pages/app/Transactions';
import ProjectWorkspace from './pages/app/ProjectWorkspace';

// Admin pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminSettings from './pages/admin/AdminSettings';
import AdminLogs from './pages/admin/AdminLogs';
import AdminDisputes from './pages/admin/AdminDisputes';
import AdminMessaging from './pages/admin/AdminMessaging';

export default function App() {
  return (
    <Routes>
      {/* Public routes (with navbar) */}
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={
          <PublicOnlyRoute><Login /></PublicOnlyRoute>
        } />
        <Route path="signup" element={
          <PublicOnlyRoute><Signup /></PublicOnlyRoute>
        } />
        <Route path="blocked" element={<Blocked />} />

        {/* Protected app routes */}
        <Route path="dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="post-task" element={
          <ProtectedRoute><PostTask /></ProtectedRoute>
        } />
        <Route path="browse" element={
          <ProtectedRoute><Browse /></ProtectedRoute>
        } />
        <Route path="tasks/:taskId" element={
          <ProtectedRoute><TaskDetail /></ProtectedRoute>
        } />
        <Route path="chats" element={
          <ProtectedRoute><ChatList /></ProtectedRoute>
        } />
        <Route path="chats/:chatId" element={
          <ProtectedRoute><ChatPage /></ProtectedRoute>
        } />
        <Route path="profile/:uid" element={
          <ProtectedRoute><Profile /></ProtectedRoute>
        } />
        <Route path="leaderboard" element={
          <ProtectedRoute><LeaderboardPage /></ProtectedRoute>
        } />
        <Route path="credits" element={
          <ProtectedRoute><Credits /></ProtectedRoute>
        } />
        <Route path="buy-credits" element={
          <ProtectedRoute><BuyCredits /></ProtectedRoute>
        } />
        <Route path="withdraw" element={
          <ProtectedRoute><Withdraw /></ProtectedRoute>
        } />
        <Route path="transactions" element={
          <ProtectedRoute><Transactions /></ProtectedRoute>
        } />
        <Route path="workspace/:workspaceId" element={
          <ProtectedRoute><ProjectWorkspace /></ProtectedRoute>
        } />
      </Route>

      {/* Admin routes (with admin sidebar) */}
      <Route path="/admin" element={
        <AdminRoute><AdminLayout /></AdminRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="disputes" element={<AdminDisputes />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="messaging" element={<AdminMessaging />} />
      </Route>

      {/* Admin login (no layout) */}
      <Route path="/admin/login" element={<AdminLogin />} />
    </Routes>
  );
}
