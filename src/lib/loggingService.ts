/**
 * Logging Service
 *
 * Stores all platform logs, payment proofs, withdrawal QRs, snapshots, etc.
 * in a local SQLite database (`local.db`) backed by IndexedDB.
 *
 * This replaces the old localStorage-backed implementation, giving us
 * essentially unlimited storage (hundreds of MB+) instead of the ~5MB
 * localStorage limit.
 */

import { insertLog, queryLogs, countLogs, getDbSizeKB, clearAllLogs as clearAllDbLogs, flush as flushDb } from './database';
import type {
  UserProfile, Task, Transaction, CreditRequest,
  Dispute, PlatformSettings, ProjectWorkspace, Delivery,
} from '../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogFileItem {
  id: string;
  name: string;
  logType: string;
  category: string;
  relatedId: string;
  data: any;
  imageData?: string;
  createdAt: string | null;
}

export interface LogFolderStructure {
  users: string[];
  tasks: string[];
  transactions: string[];
  disputes: string[];
  snapshots: string[];
  adminActions: number;
  paymentProofs: number;
  withdrawalQrs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

function uid(): string {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeTimestamp(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && 'toMillis' in (value as any)) {
    return new Date((value as any).toMillis()).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// ─── 1. Log User Full Details ────────────────────────────────────────────────
export async function logUserData(
  user: UserProfile,
  extra?: { tasks?: Task[]; transactions?: Transaction[]; creditRequests?: CreditRequest[] }
): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'user_full_details',
    exportedAt: nowISO(),
    profile: {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      bio: user.bio,
      skills: user.skills,
      role: user.role,
      credits: user.credits,
      creditsEarned: user.creditsEarned,
      creditsSpent: user.creditsSpent,
      tasksCompleted: user.tasksCompleted,
      tasksPosted: user.tasksPosted,
      clientRating: user.clientRating,
      clientRatingCount: user.clientRatingCount,
      helperRating: user.helperRating,
      helperRatingCount: user.helperRatingCount,
      isAdmin: user.isAdmin,
      isBlocked: user.isBlocked,
      createdAt: serializeTimestamp(user.createdAt),
      updatedAt: serializeTimestamp(user.updatedAt),
    },
    relatedData: extra
      ? {
          tasks: extra.tasks?.length || 0,
          transactions: extra.transactions?.length || 0,
          creditRequests: extra.creditRequests?.length || 0,
          tasksSample: extra.tasks?.slice(0, 10) || [],
          transactionsSample: extra.transactions?.slice(0, 20) || [],
          creditRequestsSample: extra.creditRequests?.slice(0, 10) || [],
        }
      : undefined,
  };

  await insertLog({
    id,
    log_type: 'user_data',
    category: 'users',
    related_id: user.uid,
    filename: 'full_details.json',
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 2. Log Payment Proof ────────────────────────────────────────────────────
export async function logPaymentProof(
  userId: string,
  requestId: string,
  proofDataUrl: string,
  amount: number,
  paymentMethod: string,
  userEmail: string
): Promise<string> {
  const id = uid();
  const metaEntry = {
    type: 'payment_proof',
    requestId,
    userId,
    userEmail,
    amount,
    paymentMethod,
    timestamp: nowISO(),
  };

  await insertLog({
    id,
    log_type: 'payment_proof',
    category: 'users',
    related_id: userId,
    filename: `payment_${requestId}.png`,
    data: metaEntry,
    image_data: proofDataUrl,
  });

  return id;
}

// ─── 3. Log Withdrawal QR Code ──────────────────────────────────────────────
export async function logWithdrawalQr(
  userId: string,
  requestId: string,
  qrDataUrl: string,
  amount: number,
  paymentDetails: string,
  userEmail: string
): Promise<string> {
  const id = uid();
  const metaEntry = {
    type: 'withdrawal_qr',
    requestId,
    userId,
    userEmail,
    amount,
    paymentDetails,
    timestamp: nowISO(),
  };

  await insertLog({
    id,
    log_type: 'withdrawal_qr',
    category: 'users',
    related_id: userId,
    filename: `withdrawal_${requestId}.png`,
    data: metaEntry,
    image_data: qrDataUrl,
  });

  return id;
}

// ─── 4. Log Transaction ─────────────────────────────────────────────────────
export async function logTransaction(transaction: Transaction): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'transaction',
    exportedAt: nowISO(),
    transaction: {
      ...transaction,
      createdAt: serializeTimestamp(transaction.createdAt),
      updatedAt: serializeTimestamp(transaction.updatedAt),
    },
  };

  await insertLog({
    id,
    log_type: 'transaction',
    category: 'transactions',
    related_id: transaction.id,
    filename: `${nowISO().replace(/[:.]/g, '-')}_${transaction.id}.json`,
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 5. Log Admin Action ────────────────────────────────────────────────────
export async function logAdminAction(
  adminId: string,
  adminName: string,
  action: string,
  targetType: string,
  targetId: string,
  oldValue: string,
  newValue: string,
  reason: string,
  extra?: Record<string, any>
): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'admin_action',
    timestamp: nowISO(),
    admin: { id: adminId, name: adminName },
    action,
    target: { type: targetType, id: targetId },
    changes: { from: oldValue, to: newValue },
    reason,
    extra,
  };

  await insertLog({
    id,
    log_type: 'admin_action',
    category: 'admin_actions',
    related_id: targetId,
    filename: `${nowISO().replace(/[:.]/g, '-')}_${action}_${targetId}.json`,
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 6. Log Task Full Details ───────────────────────────────────────────────
export async function logTaskData(
  task: Task,
  extra?: {
    clientProfile?: UserProfile | null;
    helperProfile?: UserProfile | null;
    workspace?: ProjectWorkspace | null;
    deliveries?: Delivery[];
  }
): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'task_full_details',
    exportedAt: nowISO(),
    task: {
      ...task,
      createdAt: serializeTimestamp(task.createdAt),
      updatedAt: serializeTimestamp(task.updatedAt),
      deadline: serializeTimestamp(task.deadline),
    },
    related: extra
      ? {
          client: extra.clientProfile
            ? { uid: extra.clientProfile.uid, displayName: extra.clientProfile.displayName, email: extra.clientProfile.email }
            : null,
          helper: extra.helperProfile
            ? { uid: extra.helperProfile.uid, displayName: extra.helperProfile.displayName, email: extra.helperProfile.email }
            : null,
          workspace: extra.workspace || null,
          deliveries: extra.deliveries || [],
        }
      : undefined,
  };

  await insertLog({
    id,
    log_type: 'task_data',
    category: 'tasks',
    related_id: task.id,
    filename: 'full_details.json',
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 7. Log Dispute Details ─────────────────────────────────────────────────
export async function logDisputeData(
  dispute: Dispute,
  task?: Task | null,
  actions?: any[]
): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'dispute_full_details',
    exportedAt: nowISO(),
    dispute: {
      ...dispute,
      createdAt: serializeTimestamp(dispute.createdAt),
      updatedAt: serializeTimestamp(dispute.updatedAt),
    },
    related: task
      ? {
          taskId: task.id,
          taskTitle: task.title,
          creditBounty: task.creditBounty,
          taskStatus: task.status,
        }
      : undefined,
    actions: actions || [],
  };

  await insertLog({
    id,
    log_type: 'dispute_data',
    category: 'disputes',
    related_id: dispute.id,
    filename: 'full_details.json',
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 8. Log Credit Request ──────────────────────────────────────────────────
export async function logCreditRequest(request: CreditRequest): Promise<string> {
  const id = uid();
  const logEntry = {
    type: 'credit_request',
    exportedAt: nowISO(),
    request: {
      ...request,
      createdAt: serializeTimestamp(request.createdAt),
      updatedAt: serializeTimestamp(request.updatedAt),
    },
  };

  await insertLog({
    id,
    log_type: 'credit_request',
    category: 'credit_requests',
    related_id: request.userId,
    filename: `${nowISO().replace(/[:.]/g, '-')}_${request.id}.json`,
    data: logEntry,
    image_data: null,
  });

  return id;
}

// ─── 9. Snapshot: Export All Current Data ───────────────────────────────────
export async function logFullPlatformSnapshot(
  users: UserProfile[],
  tasks: Task[],
  transactions: Transaction[],
  settings: PlatformSettings | null
): Promise<string> {
  const id = uid();
  const snapshot = {
    type: 'platform_snapshot',
    exportedAt: nowISO(),
    summary: {
      totalUsers: users.length,
      totalTasks: tasks.length,
      totalTransactions: transactions.length,
    },
    settings: settings
      ? {
          platformFeePercent: settings.platformFeePercent,
          minWithdrawal: settings.minWithdrawal,
          maxWithdrawal: settings.maxWithdrawal,
          minTaskBounty: settings.minTaskBounty,
          maxTaskBounty: settings.maxTaskBounty,
          maintenanceMode: settings.maintenanceMode,
        }
      : null,
    users: users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      role: u.role,
      credits: u.credits,
      isAdmin: u.isAdmin,
      isBlocked: u.isBlocked,
    })),
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      clientId: t.clientId,
      status: t.status,
      creditBounty: t.creditBounty,
    })),
    transactions: transactions.map(t => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      netAmount: t.netAmount,
      status: t.status,
    })),
  };

  await insertLog({
    id,
    log_type: 'platform_snapshot',
    category: 'snapshots',
    related_id: 'platform',
    filename: `${nowISO().replace(/[:.]/g, '-')}_platform_snapshot.json`,
    data: snapshot,
    image_data: null,
  });

  return id;
}

// ─── 10a. Get Payment Proofs ────────────────────────────────────────────────
export async function getPaymentProofs(): Promise<LogFileItem[]> {
  const rows = await queryLogs({ logType: 'payment_proof' });
  return rows.map(r => ({
    id: r.id,
    name: r.filename,
    logType: r.log_type,
    category: r.category,
    relatedId: r.related_id,
    data: r.data,
    imageData: r.image_data ?? undefined,
    createdAt: r.created_at,
  }));
}

// ─── 10b. Get Withdrawal QRs ────────────────────────────────────────────────
export async function getWithdrawalQrs(): Promise<LogFileItem[]> {
  const rows = await queryLogs({ logType: 'withdrawal_qr' });
  return rows.map(r => ({
    id: r.id,
    name: r.filename,
    logType: r.log_type,
    category: r.category,
    relatedId: r.related_id,
    data: r.data,
    imageData: r.image_data ?? undefined,
    createdAt: r.created_at,
  }));
}

// ─── 10c. Get Log Folder Structure ──────────────────────────────────────────
export async function getLogFolderStructure(): Promise<LogFolderStructure> {
  const allRows = await queryLogs();
  const usersSet = new Set<string>();
  const tasksSet = new Set<string>();
  const transactionsSet = new Set<string>();
  const disputesSet = new Set<string>();
  let adminActions = 0;
  let paymentProofs = 0;
  let withdrawalQrs = 0;
  const snapshots: string[] = [];

  for (const row of allRows) {
    switch (row.category) {
      case 'users':
        if (row.log_type === 'payment_proof') paymentProofs++;
        else if (row.log_type === 'withdrawal_qr') withdrawalQrs++;
        if (row.related_id) usersSet.add(row.related_id);
        break;
      case 'tasks':
        if (row.related_id) tasksSet.add(row.related_id);
        break;
      case 'transactions':
        if (row.related_id) transactionsSet.add(row.related_id);
        break;
      case 'disputes':
        if (row.related_id) disputesSet.add(row.related_id);
        break;
      case 'admin_actions':
        adminActions++;
        break;
      case 'snapshots':
        snapshots.push(row.id);
        break;
    }
  }

  return {
    users: Array.from(usersSet),
    tasks: Array.from(tasksSet),
    transactions: Array.from(transactionsSet),
    disputes: Array.from(disputesSet),
    snapshots,
    adminActions,
    paymentProofs,
    withdrawalQrs,
  };
}

// ─── 11. List all items in a log "folder" ───────────────────────────────────
export async function listLogFolder(folderPath: string): Promise<LogFileItem[]> {
  const { category, relatedId } = parsePath(folderPath);
  const rows = await queryLogs({ category, relatedId });
  return rows.map(r => ({
    id: r.id,
    name: r.filename,
    logType: r.log_type,
    category: r.category,
    relatedId: r.related_id,
    data: r.data,
    imageData: r.image_data ?? undefined,
    createdAt: r.created_at,
  }));
}

function parsePath(path: string): { category: string; relatedId?: string } {
  const parts = path.replace(/^logs\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'snapshots') return { category: 'snapshots' };
  if (parts[0] === 'data' && parts.length >= 2) {
    return { category: parts[1], relatedId: parts[2] };
  }
  return { category: parts[0] || 'unknown' };
}

// ─── 12. Clear all logs ─────────────────────────────────────────────────────
export function clearAllLogs(): void {
  clearAllDbLogs().catch(err => console.error('[Logging] Failed to clear logs:', err));
}

// ─── 13. Get total log count and size estimate ──────────────────────────────
export async function getLogStats(): Promise<{ count: number; sizeKB: number }> {
  const [count, sizeKB] = await Promise.all([countLogs(), getDbSizeKB()]);
  return { count, sizeKB };
}

// ─── 14. Ensure all logs are persisted to IndexedDB ─────────────────────────
/**
 * Flush the in-memory SQLite database to IndexedDB.
 * Call this before navigating away from a page after critical log operations
 * (e.g. signup, payment proof submission) to ensure data is durably stored.
 */
export async function flushLogs(): Promise<void> {
  await flushDb();
}
