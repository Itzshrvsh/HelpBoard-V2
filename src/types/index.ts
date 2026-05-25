import { Timestamp } from 'firebase/firestore';

// ===== User Types =====
export type UserRole = 'client' | 'helper';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  bio: string;
  skills: string[];
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isBlocked: boolean;
  credits: number;
  creditsEarned: number;
  creditsSpent: number;
  tasksCompleted: number;
  tasksPosted: number;
  clientRating: number;
  clientRatingCount: number;
  helperRating: number;
  helperRatingCount: number;
  isAdmin: boolean;
}

// ===== Task Types =====
export type TaskStatus = 
  | 'open' 
  | 'claimed' 
  | 'shortlisted' 
  | 'assigned' 
  | 'in_progress' 
  | 'pending_confirmation' 
  | 'completed' 
  | 'cancelled' 
  | 'disputed'
  | 'reassigned'
  | 'rework';

export interface Task {
  id: string;
  title: string;
  description: string;
  clientId: string;
  clientName: string;
  clientPhotoURL: string;
  creditBounty: number;
  deadline: Timestamp;
  maxClaims: number;
  claimedHelpers: string[];
  shortlistedHelpers: string[];
  finalHelperId: string | null;
  status: TaskStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  escrowHeld: boolean;
  clientConfirmed: boolean;
  helperConfirmed: boolean;
  // Project workspace fields
  workspaceId?: string;
  deliveryConfirmed?: boolean;
  deliveryConfirmedAt?: Timestamp;
  // Dispute fields
  disputeWindowEnd?: Timestamp;
  previousHelperId?: string;
  reworkRequestedAt?: Timestamp;
  reworkDeadline?: Timestamp;
  reassignedAt?: Timestamp;
}

// ===== Chat Types =====
export interface Chat {
  id: string;
  taskId: string;
  clientId: string;
  helperId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessage: string;
  lastMessageTime: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderPhotoURL: string;
  content: string;
  type: 'text' | 'skill_proof' | 'system' | 'progress_update' | 'file_upload' | 'video_proof' | 'delivery' | 'confirmation' | 'dispute' | 'rework' | 'reassignment';
  proofUrl?: string;
  proofDescription?: string;
  createdAt: Timestamp;
}

// ===== Transaction Types =====
export type TransactionType = 'purchase' | 'withdrawal' | 'task_payment' | 'task_refund' | 'fee' | 'admin_adjustment' | 'escrow_hold' | 'escrow_release';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  fee: number;
  netAmount: number;
  status: TransactionStatus;
  description: string;
  taskId?: string;
  adminId?: string;
  paymentProof?: string;
  paymentMethod?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Rating Types =====
export interface Rating {
  id: string;
  taskId: string;
  fromUserId: string;
  toUserId: string;
  fromRole: UserRole;
  score: number;
  description: string;
  createdAt: Timestamp;
}

// ===== Platform Settings =====
export interface PlatformSettings {
  platformFeePercent: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  minTaskBounty: number;
  maxTaskBounty: number;
  qrPaymentImage: string;
  paymentInstructions: string;
  withdrawalRules: string;
  maintenanceMode: boolean;
  updatedAt: Timestamp;
  updatedBy: string;
}

// ===== Admin Log =====
export interface AdminLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetType: 'user' | 'task' | 'payment' | 'withdrawal' | 'setting' | 'dispute';
  targetId: string;
  oldValue: string;
  newValue: string;
  reason: string;
  createdAt: Timestamp;
}

// ===== Dispute =====
export interface Dispute {
  id: string;
  taskId: string;
  raisedBy: string;
  raisedByName: string;
  reason: DisputeReason;
  description: string;
  severity: DisputeSeverity;
  status: 'open' | 'admin_review' | 'rework' | 'resolved';
  expectedResult?: string;
  actualIssue?: string;
  screenshots?: string[];
  resolvedBy?: string;
  resolution?: string;
  action?: 'release_to_helper' | 'refund_client' | 'partial_refund' | 'rework' | 'reassign';
  partialRefundAmount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  disputeWindowEnd?: Timestamp;
}

// ===== Project Workspace =====
export interface ProjectWorkspace {
  id: string;
  taskId: string;
  clientId: string;
  helperId: string;
  status: 'active' | 'delivered' | 'completed' | 'disputed' | 'rework' | 'reassigned';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deliveryConfirmed: boolean;
  deliveryConfirmedAt?: Timestamp;
  downloadEnabled: boolean;
  currentVersion: number;
}

// ===== Progress Updates =====
export type ProgressStatus = 'planning' | 'in_progress' | 'testing' | 'fixing' | 'finalizing' | 'submitted';

export interface ProgressUpdate {
  id: string;
  workspaceId: string;
  taskId: string;
  helperId: string;
  helperName: string;
  title: string;
  description: string;
  status: ProgressStatus;
  fileUrl?: string;
  fileName?: string;
  createdAt: Timestamp;
}

// ===== Deliveries =====
export interface Delivery {
  id: string;
  workspaceId: string;
  taskId: string;
  helperId: string;
  version: number;
  isRevision: boolean;
  deliveryNotes: string;
  versionLabel: string;
  checklistCompleted: boolean;
  checklist: DeliveryChecklist;
  files: DeliveryFile[];
  proofVideo: ProofVideo | null;
  status: 'submitted' | 'confirmed' | 'rejected';
  confirmedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DeliveryChecklist {
  projectRuns: boolean;
  featuresCompleted: boolean;
  noMaliciousFiles: boolean;
  setupInstructionsIncluded: boolean;
  proofVideoUploaded: boolean;
  clientRequirementsChecked: boolean;
}

export interface DeliveryFile {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedAt: Timestamp;
}

export interface ProofVideo {
  id: string;
  name: string;
  url: string;
  size: number;
  duration?: number;
  uploadedBy: string;
  uploadedAt: Timestamp;
}

// ===== Notifications =====
export type NotificationType = 
  | 'helper_selected'
  | 'new_message'
  | 'progress_update'
  | 'project_uploaded'
  | 'video_proof_uploaded'
  | 'delivery_confirmed'
  | 'credits_released'
  | 'rating_required'
  | 'dispute_raised'
  | 'rework_requested'
  | 'revised_project_uploaded'
  | 'task_reassigned'
  | 'dispute_resolved';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  taskId?: string;
  workspaceId?: string;
  read: boolean;
  createdAt: Timestamp;
}

// ===== Enhanced Dispute =====
export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';
export type DisputeReason = 
  | 'project_does_not_work'
  | 'missing_features'
  | 'poor_quality'
  | 'wrong_files'
  | 'fake_proof'
  | 'malicious_files'
  | 'missing_setup_instructions'
  | 'other';

export interface DisputeAction {
  id: string;
  disputeId: string;
  adminId: string;
  adminName: string;
  action: string;
  reason: string;
  note: string;
  createdAt: Timestamp;
}

// ===== Leaderboard Stats =====
export interface LeaderboardStats {
  userId: string;
  displayName: string;
  photoURL: string;
  totalTasksCompleted: number;
  totalTasksPosted: number;
  totalCreditsEarned: number;
  totalCreditsSpent: number;
  averageClientRating: number;
  averageHelperRating: number;
  totalRatings: number;
  updatedAt: Timestamp;
}
