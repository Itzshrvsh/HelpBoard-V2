# HelpBoard V3 - Project Understanding

## 📋 Overview

**HelpBoard V3** is a full-stack task marketplace platform built with React, TypeScript, and Firebase. It connects clients who need help with tasks to helpers (freelancers) in a gamified credit-based economy.

---

## 🏗️ Architecture & Tech Stack

### Frontend Framework
- **React 18** + **TypeScript** - Type-safe component architecture
- **Vite** - Fast build tool and dev server (port 3000)
- **React Router v6** - Client-side routing with nested layouts
- **Tailwind CSS** - Utility-first styling
- **Framer Motion** - Smooth animations
- **Lucide React** - Icon library
- **date-fns** - Date formatting utilities
- **react-hot-toast** - Toast notifications

### Backend & Database
- **Firebase** (v11)
  - Authentication (Email/Password)
  - Firestore (NoSQL database)
  - Storage (file uploads)

---

## 📁 Project Structure

```
src/
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx      # Admin panel sidebar layout
│   │   ├── AppLayout.tsx        # Main site with navbar
│   │   ├── Navbar.tsx          # Top navigation bar
│   │   └── ProtectedRoute.tsx  # Route guards (Public/Protected/Admin)
│   └── ui/
│       ├── Avatar.tsx
│       ├── Button.tsx
│       ├── Card.tsx
│       ├── CountdownTimer.tsx
│       ├── Input.tsx
│       ├── LoadingScreen.tsx
│       ├── Modal.tsx
│       ├── NotificationBell.tsx
│       ├── StatusBadge.tsx
│       └── TaskCard.tsx
├── contexts/
│   └── AuthContext.tsx         # Firebase auth + role management
├── hooks/
│   └── useRateLimit.ts        # API rate limiting
├── lib/
│   ├── firebase.ts            # Firebase initialization
│   ├── firebaseServices.ts    # All Firestore operations
│   └── utils.ts               # Helper functions, validators
├── pages/
│   ├── admin/                 # Admin panel pages
│   │   ├── AdminDashboard.tsx
│   │   ├── AdminDisputes.tsx
│   │   ├── AdminLogin.tsx
│   │   ├── AdminLogs.tsx
│   │   ├── AdminPayments.tsx
│   │   ├── AdminSettings.tsx
│   │   ├── AdminUsers.tsx
│   │   └── AdminWithdrawals.tsx
│   ├── app/                   # User-facing pages
│   │   ├── Browse.tsx         # Task discovery
│   │   ├── BuyCredits.tsx
│   │   ├── ChatList.tsx
│   │   ├── ChatPage.tsx
│   │   ├── Credits.tsx
│   │   ├── Dashboard.tsx      # User home page
│   │   ├── LeaderboardPage.tsx
│   │   ├── PostTask.tsx
│   │   ├── Profile.tsx
│   │   ├── ProjectWorkspace.tsx
│   │   ├── TaskDetail.tsx
│   │   ├── Transactions.tsx
│   │   └── Withdraw.tsx
│   └── public/                # Auth pages
│       ├── Blocked.tsx
│       ├── Landing.tsx
│       ├── Login.tsx
│       └── Signup.tsx
├── types/
│   └── index.ts               # All TypeScript interfaces
├── App.tsx                    # Route definitions
├── main.tsx                   # Entry point
└── vite-env.d.ts              # Vite type declarations
```

---

## 🗄️ Database Schema

### Core Collections

| Collection | Purpose |
|------------|---------|
| `users` | User profiles (clients & helpers) |
| `tasks` | Task postings with claims/shortlistings |
| `chats` | Chat threads between clients/helpers |
| `messages` | Individual chat messages |
| `transactions` | Credit transactions (purchases, withdrawals, payments) |
| `creditRequests` | Client credit purchase requests |
| `withdrawalRequests` | Helper withdrawal requests |
| `ratings` | User ratings after task completion |
| `platformSettings` | Platform configuration (single doc: 'config') |
| `adminLogs` | Audit trail of admin actions |
| `disputes` | Dispute records for completed tasks |
| `projectWorkspaces` | Active project collaboration spaces |
| `deliveries` | File/project deliveries with proofs |
| `progressUpdates` | Helper progress milestones |
| `notifications` | Push notifications to users |

---

## 🎭 User Roles & Types

### UserRole
- `'client'` - Task posters who pay credits
- `'helper'` - Freelancers who complete tasks and earn credits

### TaskStatus Lifecycle
```
open → claimed → shortlisted → assigned → in_progress 
→ pending_confirmation → completed
                    ↓
              disputed → resolved (release/refund)
                    ↓
               rework → resubmit
                    ↓
                reassigned
```

---

## 💰 Credit Economy

### How Credits Work
1. **Purchase**: Clients buy credits via QR code payment proof
2. **Spending**: Each task posting deducts credit bounty from client's balance
3. **Earning**: Helpers receive payout (bounty - platform fee) on completion
4. **Withdrawal**: Helpers convert earned credits to real money

### Platform Fee Model
- Default: 5% of task bounty
- Calculated at delivery confirmation
- Helper receives: `bounty - (bounty × fee_percent/100)`

---

## 🔐 Security & Access Control

### Route Protection Layers

| Guard | Component | Purpose |
|-------|-----------|---------|
| Auth Check | `ProtectedRoute` | Requires Firebase auth |
| Admin Only | `AdminRoute` | Checks `userProfile.isAdmin` flag |
| Guest Only | `PublicOnlyRoute` | Redirects logged-in users |

### Role Switching (Dev Feature)
- Stored in localStorage as `'helpboard_role'`
- Defaults to `'helper'` if not set
- Can be overridden by actual Firestore profile.role

---

## 📡 Key Firebase Services

### Authentication
```typescript
// Sign up creates user + Firestore profile
export async function signUp(email, password, displayName)

// Login returns authenticated user
export async function logIn(email, password)

// Logout signs out Firebase auth
export async function logOut()
```

### Task Management
```typescript
// Creates task with escrow hold
export async function createTask(taskData)

// Helper claims a task (adds to claimedHelpers array)
export async function claimTask(taskId, userId)

// Client shortlists up to 3 helpers
export async function shortlistHelper(taskId, userId)

// Selects final helper → creates workspace
export async function selectFinalHelper(taskId, userId)
```

### Payments & Withdrawals
```typescript
// Helper requests withdrawal
export async function requestWithdrawal(amount, paymentDetails)

// Admin approves/rejects with credit adjustment
export async function approveWithdrawal(requestId, userId, amount, adminId)
```

---

## 🔄 Real-time Subscriptions

The app uses `onSnapshot` for live updates:

```typescript
// Subscribe to user's tasks (both posted and claimed)
subscribeToUserTasks(uid, role, callback)

// Subscribe to open tasks for browsing
subscribeToTasks(callback, status = 'open')

// Subscribe to chat messages
subscribeToMessages(chatId, callback)
```

---

## 🎯 Key Features Implemented

### For Clients
- ✅ Post tasks with bounty & deadline
- ✅ Browse and claim tasks as helpers
- ✅ Shortlist/select final helper from claims
- ✅ Confirm task completion → triggers payout
- ✅ Rate helpers after delivery
- ✅ Request credit purchases (QR payment proof)
- ✅ Withdraw earned credits

### For Helpers
- ✅ Claim available tasks
- ✅ Progress updates with file attachments
- ✅ Submit deliveries with checklist & proofs
- ✅ Receive escrow release on confirmation
- ✅ Rate clients after completion
- ✅ Request withdrawals

### For Admins
- ✅ User management (block/unblock, role changes)
- ✅ Payment request approval/rejection
- ✅ Withdrawal request moderation
- ✅ Dispute resolution with partial refunds
- ✅ Platform settings configuration
- ✅ Full audit log viewing

---

## 🚀 Development Commands

```bash
# Start dev server (port 3000)
npm run dev

# Build for production
npm run build

# Type check
npm run lint
```

### Environment Variables (`.env`)
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...
```

---

## 📊 Data Flow Examples

### Task Creation Flow
1. Client posts task → credits deducted + escrow held
2. Helpers claim tasks (up to `maxClaims` slots)
3. Client shortlists up to 3 helpers
4. Client selects final helper → workspace created
5. Helper works → progress updates uploaded
6. Helper submits delivery → client confirms
7. Platform fee calculated → helper credited, task completed
8. Both parties rate each other

### Dispute Flow
1. Either party raises dispute within window
2. Task status → `disputed`
3. Admin reviews evidence/screenshots
4. Actions: release to helper, refund client, partial refund, rework, or reassign
5. All actions logged in adminLogs collection

---

## 🔧 Notable Implementation Details

### Transaction Safety
- Uses `runTransaction` for atomic operations (credit deductions, escrow holds)
- Batch writes with `writeBatch` for efficiency

### Rate Limiting
Defined in `utils.ts`: login attempts, task posting limits, chat message throttling

### File Uploads
- Profile photos stored in `/profiles/{uid}/{filename}`
- Project files stored per workspace/delivery
- Proof videos tracked with metadata (duration, size)

---

## 📝 Summary

HelpBoard V3 is a **production-ready task marketplace** with:
- Full CRUD operations on all entities
- Real-time bidirectional sync via Firestore listeners
- Secure role-based access control
- Complete audit trail via admin logs
- Dispute resolution workflow
- Escrow-based payment security
- Multi-version delivery tracking for projects

The codebase demonstrates solid Firebase patterns with proper transaction usage, real-time subscriptions, and comprehensive type safety throughout.
