import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit,
  serverTimestamp, Timestamp, arrayUnion, arrayRemove, increment, runTransaction, writeBatch,
  onSnapshot, DocumentReference, DocumentData, addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, storage } from './firebase';
import { formatCredits } from './utils';
import type {
  UserProfile, Task, TaskStatus, Chat, Message, Transaction, Rating, PlatformSettings, AdminLog,
  Dispute, LeaderboardStats, ProjectWorkspace, ProgressUpdate, ProgressStatus,
  Delivery, DeliveryFile, ProofVideo, Notification, NotificationType, DisputeAction,
  DisputeSeverity, DisputeReason, DeliveryChecklist
} from '../types';

// ===== Auth Services =====
export async function signUp(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    email,
    displayName,
    photoURL: '',
    bio: '',
    skills: [],
    role: 'helper',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    isBlocked: false,
    credits: 0,
    creditsEarned: 0,
    creditsSpent: 0,
    tasksCompleted: 0,
    tasksPosted: 0,
    clientRating: 0,
    clientRatingCount: 0,
    helperRating: 0,
    helperRatingCount: 0,
    isAdmin: false,
  });
  return cred.user;
}

export async function logIn(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

// ===== User Services =====
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export function subscribeToUserProfile(uid: string, callback: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, 'users', uid), (snap) => {
    callback(snap.exists() ? (snap.data() as UserProfile) : null);
  });
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserRole(uid: string, role: 'client' | 'helper') {
  await updateDoc(doc(db, 'users', uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  const storageRef = ref(storage, `profiles/${uid}/${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  await updateDoc(doc(db, 'users', uid), { photoURL: url, updatedAt: serverTimestamp() });
  return url;
}

export async function searchUsers(searchTerm: string): Promise<UserProfile[]> {
  const q = query(
    collection(db, 'users'),
    orderBy('displayName'),
    limit(20)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => d.data() as UserProfile)
    .filter(u => u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));
}

// ===== Task Services =====
export async function createTask(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { clientId: string }): Promise<string> {
  const userRef = doc(db, 'users', data.clientId);
  const userSnap = await getDoc(userRef);
  const user = userSnap.data() as UserProfile;

  if (!user || user.credits < data.creditBounty) {
    throw new Error('Insufficient credits');
  }

  const taskRef = doc(collection(db, 'tasks'));
  
  await runTransaction(db, async (transaction) => {
    const freshUser = await transaction.get(userRef);
    if (!freshUser.exists()) throw new Error('User not found');
    const userData = freshUser.data() as UserProfile;
    if (userData.credits < data.creditBounty) throw new Error('Insufficient credits');

    transaction.update(userRef, {
      credits: increment(-data.creditBounty),
      creditsSpent: increment(data.creditBounty),
      tasksPosted: increment(1),
    });

    transaction.set(taskRef, {
      ...data,
      id: taskRef.id,
      status: 'open',
      claimedHelpers: [],
      shortlistedHelpers: [],
      finalHelperId: null,
      escrowHeld: true,
      clientConfirmed: false,
      helperConfirmed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create escrow transaction
    const escrowRef = doc(collection(db, 'transactions'));
    transaction.set(escrowRef, {
      id: escrowRef.id,
      userId: data.clientId,
      type: 'escrow_hold',
      amount: data.creditBounty,
      fee: 0,
      netAmount: data.creditBounty,
      status: 'completed',
      description: `Escrow hold for task: ${data.title}`,
      taskId: taskRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return taskRef.id;
}

export function subscribeToTasks(callback: (tasks: Task[]) => void,status?: TaskStatus) {
  let q;
  if (status) {
    q = query(
      collection(db, 'tasks'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  } else {
    q = query(
      collection(db, 'tasks'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
  });
}

export function subscribeToUserTasks(userId: string, role: 'client' | 'helper', callback: (tasks: Task[]) => void) {
  let q;
  if (role === 'client') {
    q = query(
      collection(db, 'tasks'),
      where('clientId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  } else {
    q = query(
      collection(db, 'tasks'),
      where('claimedHelpers', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Task)));
  });
}

export function subscribeToTask(taskId: string, callback: (task: Task | null) => void) {
  return onSnapshot(doc(db, 'tasks', taskId), (snap) => {
    callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as Task) : null);
  });
}

export async function claimTask(taskId: string, userId: string, userName: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.status !== 'open') throw new Error('Task is not open for claims');
    if (task.claimedHelpers.includes(userId)) throw new Error('Already claimed this task');
    if (task.claimedHelpers.length >= task.maxClaims) throw new Error('Max claim limit reached');
    if (task.clientId === userId) throw new Error('Cannot claim your own task');

    transaction.update(taskRef, {
      claimedHelpers: arrayUnion(userId),
      status: task.claimedHelpers.length + 1 >= task.maxClaims ? 'claimed' : 'open',
      updatedAt: serverTimestamp(),
    });

    // Create chat
    const chatRef = doc(collection(db, 'chats'));
    transaction.set(chatRef, {
      id: chatRef.id,
      taskId,
      clientId: task.clientId,
      helperId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastMessage: `${userName} claimed the task`,
      lastMessageTime: serverTimestamp(),
    });
  });
}

export async function shortlistHelper(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.clientId !== auth.currentUser?.uid) throw new Error('Only client can shortlist');
    if (task.shortlistedHelpers.length >= 3) throw new Error('Max 3 helpers can be shortlisted');
    if (task.shortlistedHelpers.includes(userId)) throw new Error('Already shortlisted');

    transaction.update(taskRef, {
      shortlistedHelpers: arrayUnion(userId),
      status: 'shortlisted',
      updatedAt: serverTimestamp(),
    });
  });
}

export async function selectFinalHelper(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.clientId !== auth.currentUser?.uid) throw new Error('Only client can select final helper');
    if (!task.shortlistedHelpers.includes(userId)) throw new Error('Helper must be shortlisted first');

    // Create project workspace
    const workspaceRef = doc(collection(db, 'projectWorkspaces'));
    transaction.set(workspaceRef, {
      id: workspaceRef.id,
      taskId,
      clientId: task.clientId,
      helperId: userId,
      status: 'active',
      deliveryConfirmed: false,
      downloadEnabled: false,
      currentVersion: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(taskRef, {
      finalHelperId: userId,
      status: 'assigned',
      workspaceId: workspaceRef.id,
      updatedAt: serverTimestamp(),
    });

    // Create notification for helper
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      id: notifRef.id,
      userId,
      type: 'helper_selected',
      title: 'You were selected!',
      message: `You were selected as the final helper for "${task.title}"`,
      taskId,
      workspaceId: workspaceRef.id,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function startTaskProgress(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.finalHelperId !== userId) throw new Error('Only the selected helper can start working');
    if (task.status !== 'assigned') throw new Error('Task must be assigned first');

    transaction.update(taskRef, {
      status: 'in_progress',
      updatedAt: serverTimestamp(),
    });
  });
}

export async function helperRequestsCompletion(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.finalHelperId !== userId) throw new Error('Only the assigned helper can request completion');
    if (task.status !== 'in_progress') throw new Error('Task must be in progress');

    transaction.update(taskRef, {
      status: 'pending_confirmation',
      helperConfirmed: true,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function clientConfirmsCompletion(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.clientId !== userId) throw new Error('Only the client can confirm completion');
    if (task.status !== 'pending_confirmation') throw new Error('Helper must request completion first');

    // Get platform fee settings
    const settingsSnap = await transaction.get(doc(db, 'platformSettings', 'config'));
    const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { platformFeePercent: 5 };
    
    const fee = Math.floor(task.creditBounty * (settings.platformFeePercent || 5) / 100);
    const helperPayout = task.creditBounty - fee;

    // Credit the helper
    transaction.update(doc(db, 'users', task.finalHelperId!), {
      credits: increment(helperPayout),
      creditsEarned: increment(helperPayout),
      tasksCompleted: increment(1),
    });

    // Create release transaction
    const releaseRef = doc(collection(db, 'transactions'));
    transaction.set(releaseRef, {
      id: releaseRef.id,
      userId: task.finalHelperId,
      type: 'escrow_release',
      amount: helperPayout,
      fee,
      netAmount: helperPayout,
      status: 'completed',
      description: `Payment for task: ${task.title}`,
      taskId: task.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(taskRef, {
      status: 'completed',
      clientConfirmed: true,
      escrowHeld: false,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function cancelTask(taskId: string, userId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.clientId !== userId) throw new Error('Only client can cancel');
    if (task.status === 'completed' || task.status === 'disputed') throw new Error('Cannot cancel completed/disputed task');

    // Refund escrow amount
    if (task.escrowHeld) {
      transaction.update(doc(db, 'users', userId), {
        credits: increment(task.creditBounty),
      });
    }

    transaction.update(taskRef, {
      status: 'cancelled',
      escrowHeld: false,
      updatedAt: serverTimestamp(),
    });
  });
}

// ===== Chat Services =====
export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void) {
  const q = query(
    collection(db, 'chats'),
    where('clientId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );
  
  const q2 = query(
    collection(db, 'chats'),
    where('helperId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(50)
  );

  let clientChats: Chat[] = [];
  let helperChats: Chat[] = [];

  const emit = () => {
    const merged = [...clientChats, ...helperChats];
    // Deduplicate by id and sort by most recent
    const unique = merged.filter((c, i, arr) => arr.findIndex(c2 => c2.id === c.id) === i);
    unique.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
    callback(unique);
  };

  const unsub1 = onSnapshot(q, (snap) => {
    clientChats = snap.docs.map(d => ({ ...d.data(), id: d.id } as Chat));
    emit();
  });

  const unsub2 = onSnapshot(q2, (snap) => {
    helperChats = snap.docs.map(d => ({ ...d.data(), id: d.id } as Chat));
    emit();
  });

  return () => { unsub1(); unsub2(); };
}

export function subscribeToMessages(chatId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, 'messages'),
    where('chatId', '==', chatId)
    // No limit — fetch all documents to sort correctly client-side
  );
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ ...d.data(), id: d.id } as Message));
    // Sort client-side to avoid requiring a composite Firestore index
    msgs.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    callback(msgs);
  }, (error) => {
    console.error('subscribeToMessages error:', error);
    callback([]);
  });
}

export async function sendMessage(chatId: string, content: string, type: 'text' | 'skill_proof' = 'text', proofUrl?: string, proofDescription?: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const msgRef = doc(collection(db, 'messages'));
  await setDoc(msgRef, {
    id: msgRef.id,
    chatId,
    senderId: user.uid,
    senderName: user.displayName || 'Unknown',
    senderPhotoURL: user.photoURL || '',
    content,
    type,
    proofUrl: proofUrl || '',
    proofDescription: proofDescription || '',
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, 'chats', chatId), {
    lastMessage: content,
    lastMessageTime: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getChatByTaskAndHelper(taskId: string, helperId: string): Promise<string | null> {
  // Single-field where to avoid requiring a composite Firestore index
  const q = query(
    collection(db, 'chats'),
    where('taskId', '==', taskId),
    limit(20)
  );
  try {
    const snap = await getDocs(q);
    const chat = snap.docs.find(d => d.data().helperId === helperId);
    return chat ? chat.id : null;
  } catch (err) {
    console.error('getChatByTaskAndHelper error:', err);
    return null;
  }
}

// ===== Credit/Transaction Services =====
export function subscribeToTransactions(userId: string, callback: (transactions: Transaction[]) => void) {
  const q = query(
    collection(db, 'transactions'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
  });
}

export async function submitPaymentProof(amount: number, paymentMethod: string, proofUrl: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const ref = doc(collection(db, 'creditRequests'));
  await setDoc(ref, {
    id: ref.id,
    userId: user.uid,
    userEmail: user.email,
    amount,
    paymentMethod,
    proofUrl,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function requestWithdrawal(amount: number, paymentDetails: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const userSnap = await getDoc(doc(db, 'users', user.uid));
  const userData = userSnap.data() as UserProfile;

  const settingsSnap = await getDoc(doc(db, 'platformSettings', 'config'));
  const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { minWithdrawal: 100, maxWithdrawal: 10000 };

  if (userData.credits < amount) throw new Error('Insufficient credits');
  if (amount < (settings.minWithdrawal || 100)) throw new Error(`Minimum withdrawal is ${settings.minWithdrawal} credits`);
  if (amount > (settings.maxWithdrawal || 10000)) throw new Error(`Maximum withdrawal is ${settings.maxWithdrawal} credits`);

  const ref = doc(collection(db, 'withdrawalRequests'));
  await runTransaction(db, async (transaction) => {
    const freshUser = await transaction.get(doc(db, 'users', user.uid));
    if (!freshUser.exists()) throw new Error('User not found');
    const uData = freshUser.data() as UserProfile;
    if (uData.credits < amount) throw new Error('Insufficient credits');

    transaction.update(doc(db, 'users', user.uid), {
      credits: increment(-amount),
    });

    transaction.set(ref, {
      id: ref.id,
      userId: user.uid,
      userEmail: user.email,
      amount,
      paymentDetails,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// ===== Rating Services =====
export async function submitRating(taskId: string, toUserId: string, score: number, description: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  if (score < 1 || score > 5) throw new Error('Rating must be between 1 and 5');

  const ref = doc(collection(db, 'ratings'));
  
  await runTransaction(db, async (transaction) => {
    // All reads first
    const userSnap = await transaction.get(doc(db, 'users', user.uid));
    const userData = userSnap.data() as UserProfile;

    const toUserRef = doc(db, 'users', toUserId);
    const toUserSnap = await transaction.get(toUserRef);
    const toUserData = toUserSnap.data() as UserProfile;

    // Then all writes
    transaction.set(ref, {
      id: ref.id,
      taskId,
      fromUserId: user.uid,
      toUserId,
      fromRole: userData.role,
      score,
      description,
      createdAt: serverTimestamp(),
    });

    // Update user's average rating
    if (userData.role === 'client') {
      const newCount = (toUserData.helperRatingCount || 0) + 1;
      const newAvg = ((toUserData.helperRating || 0) * (toUserData.helperRatingCount || 0) + score) / newCount;
      transaction.update(toUserRef, {
        helperRating: Math.round(newAvg * 10) / 10,
        helperRatingCount: newCount,
      });
    } else {
      const newCount = (toUserData.clientRatingCount || 0) + 1;
      const newAvg = ((toUserData.clientRating || 0) * (toUserData.clientRatingCount || 0) + score) / newCount;
      transaction.update(toUserRef, {
        clientRating: Math.round(newAvg * 10) / 10,
        clientRatingCount: newCount,
      });
    }
  });
}

// ===== Platform Settings =====
export function subscribeToPlatformSettings(callback: (settings: PlatformSettings | null) => void) {
  return onSnapshot(doc(db, 'platformSettings', 'config'), (snap) => {
    callback(snap.exists() ? (snap.data() as PlatformSettings) : null);
  });
}

export async function updatePlatformSettings(settings: Partial<PlatformSettings>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  await updateDoc(doc(db, 'platformSettings', 'config'), {
    ...settings,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });
}

// ===== Admin Services =====
export function subscribeToAllTransactions(callback: (transactions: Transaction[]) => void) {
  const q = query(
    collection(db, 'transactions'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
  });
}

export function subscribeToCreditRequests(callback: (requests: Transaction[]) => void) {
  const q = query(
    collection(db, 'creditRequests'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
  });
}

export function subscribeToWithdrawalRequests(callback: (requests: Transaction[]) => void) {
  const q = query(
    collection(db, 'withdrawalRequests'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Transaction)));
  });
}

export async function approveCreditRequest(requestId: string, userId: string, amount: number, adminId: string) {
  await runTransaction(db, async (transaction) => {
    transaction.update(doc(db, 'users', userId), {
      credits: increment(amount),
    });
    transaction.update(doc(db, 'creditRequests', requestId), {
      status: 'approved',
      adminId,
      updatedAt: serverTimestamp(),
    });

    const txnRef = doc(collection(db, 'transactions'));
    transaction.set(txnRef, {
      id: txnRef.id,
      userId,
      type: 'purchase',
      amount,
      fee: 0,
      netAmount: amount,
      status: 'completed',
      description: 'Credit purchase approved',
      adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Log the action
    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      id: logRef.id,
      adminId,
      action: 'approve_credit_purchase',
      targetType: 'payment',
      targetId: requestId,
      oldValue: '0',
      newValue: String(amount),
      reason: `Approved credit purchase of ${amount}`,
      createdAt: serverTimestamp(),
    });
  });
}

export async function rejectCreditRequest(requestId: string, adminId: string, reason: string) {
  await updateDoc(doc(db, 'creditRequests', requestId), {
    status: 'rejected',
    adminId,
    reason,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'adminLogs'), {
    adminId,
    action: 'reject_credit_purchase',
    targetType: 'payment',
    targetId: requestId,
    oldValue: 'pending',
    newValue: 'rejected',
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function approveWithdrawal(requestId: string, userId: string, amount: number, adminId: string) {
  await updateDoc(doc(db, 'withdrawalRequests', requestId), {
    status: 'approved',
    adminId,
    updatedAt: serverTimestamp(),
  });

  const txnRef = doc(collection(db, 'transactions'));
  await setDoc(txnRef, {
    id: txnRef.id,
    userId,
    type: 'withdrawal',
    amount,
    fee: 0,
    netAmount: amount,
    status: 'completed',
    description: 'Withdrawal approved',
    adminId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'adminLogs'), {
    adminId,
    action: 'approve_withdrawal',
    targetType: 'withdrawal',
    targetId: requestId,
    oldValue: 'pending',
    newValue: 'approved',
    reason: `Withdrawal of ${amount} approved`,
    createdAt: serverTimestamp(),
  });
}

export async function rejectWithdrawal(requestId: string, userId: string, amount: number, adminId: string, reason: string) {
  await runTransaction(db, async (transaction) => {
    transaction.update(doc(db, 'withdrawalRequests', requestId), {
      status: 'rejected',
      adminId,
      reason,
      updatedAt: serverTimestamp(),
    });
    // Refund the amount
    transaction.update(doc(db, 'users', userId), {
      credits: increment(amount),
    });

    // Log the action
    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      id: logRef.id,
      adminId,
      action: 'reject_withdrawal',
      targetType: 'withdrawal',
      targetId: requestId,
      oldValue: 'pending',
      newValue: 'rejected',
      reason,
      createdAt: serverTimestamp(),
    });
  });
}

export async function adminAdjustCredits(userId: string, amount: number, adminId: string, reason: string) {
  await runTransaction(db, async (transaction) => {
    transaction.update(doc(db, 'users', userId), {
      credits: increment(amount),
    });

    const txnRef = doc(collection(db, 'transactions'));
    transaction.set(txnRef, {
      id: txnRef.id,
      userId,
      type: 'admin_adjustment',
      amount: Math.abs(amount),
      fee: 0,
      netAmount: amount,
      status: 'completed',
      description: `Admin adjustment: ${reason}`,
      adminId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      id: logRef.id,
      adminId,
      action: 'adjust_credits',
      targetType: 'user',
      targetId: userId,
      oldValue: '0',
      newValue: String(amount),
      reason,
      createdAt: serverTimestamp(),
    });
  });
}

export async function adminBlockUser(userId: string, adminId: string, block: boolean) {
  await updateDoc(doc(db, 'users', userId), {
    isBlocked: block,
    updatedAt: serverTimestamp(),
  });

  await addDoc(collection(db, 'adminLogs'), {
    adminId,
    action: block ? 'block_user' : 'unblock_user',
    targetType: 'user',
    targetId: userId,
    oldValue: String(!block),
    newValue: String(block),
    reason: '',
    createdAt: serverTimestamp(),
  });
}

export async function resolveDispute(taskId: string, adminId: string, action: 'release_to_helper' | 'refund_client', reason: string) {
  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(doc(db, 'tasks', taskId));
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (action === 'release_to_helper') {
      const settingsSnap = await transaction.get(doc(db, 'platformSettings', 'config'));
      const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { platformFeePercent: 5 };
      const fee = Math.floor(task.creditBounty * (settings.platformFeePercent || 5) / 100);
      const payout = task.creditBounty - fee;

      transaction.update(doc(db, 'users', task.finalHelperId!), {
        credits: increment(payout),
        creditsEarned: increment(payout),
      });
    } else if (action === 'refund_client') {
      transaction.update(doc(db, 'users', task.clientId), {
        credits: increment(task.creditBounty),
      });
    }

    transaction.update(doc(db, 'tasks', taskId), {
      status: action === 'release_to_helper' ? 'completed' : 'cancelled',
      escrowHeld: false,
      updatedAt: serverTimestamp(),
    });
  });

  await addDoc(collection(db, 'adminLogs'), {
    adminId,
    action: `resolve_dispute_${action}`,
    targetType: 'dispute',
    targetId: taskId,
    oldValue: 'disputed',
    newValue: action === 'release_to_helper' ? 'completed' : 'cancelled',
    reason,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToAllUsers(callback: (users: UserProfile[]) => void) {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as UserProfile));
  });
}

export function subscribeToAdminLogs(callback: (logs: AdminLog[]) => void) {
  const q = query(collection(db, 'adminLogs'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as AdminLog)));
  });
}

export function subscribeToLeaderboard(callback: (stats: LeaderboardStats[]) => void) {
  const q = query(collection(db, 'leaderboardStats'), orderBy('totalTasksCompleted', 'desc'), limit(50));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => d.data() as LeaderboardStats));
  });
}

export async function getTaskRatings(taskId: string): Promise<Rating[]> {
  const q = query(collection(db, 'ratings'), where('taskId', '==', taskId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Rating));
}

export async function getUserRatings(userId: string): Promise<Rating[]> {
  const q = query(collection(db, 'ratings'), where('toUserId', '==', userId), orderBy('createdAt', 'desc'), limit(20));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as Rating));
}

// ===== Project Workspace Services =====
export function subscribeToWorkspace(workspaceId: string, callback: (workspace: ProjectWorkspace | null) => void) {
  return onSnapshot(doc(db, 'projectWorkspaces', workspaceId), (snap) => {
    callback(snap.exists() ? ({ ...snap.data(), id: snap.id } as ProjectWorkspace) : null);
  });
}

export async function getWorkspaceByTask(taskId: string): Promise<ProjectWorkspace | null> {
  const q = query(collection(db, 'projectWorkspaces'), where('taskId', '==', taskId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { ...snap.docs[0].data(), id: snap.docs[0].id } as ProjectWorkspace;
}

// ===== Progress Update Services =====
export async function addProgressUpdate(
  workspaceId: string, taskId: string, helperId: string, helperName: string,
  data: { title: string; description: string; status: ProgressStatus; fileUrl?: string; fileName?: string }
) {
  const ref = doc(collection(db, 'progressUpdates'));
  await setDoc(ref, {
    id: ref.id,
    workspaceId,
    taskId,
    helperId,
    helperName,
    ...data,
    createdAt: serverTimestamp(),
  });

  // Notify client
  await createNotification({
    userId: '', taskId, workspaceId,
    type: 'progress_update',
    title: 'Progress Update',
    message: `${helperName} posted a progress update: ${data.title}`,
  });

  return ref.id;
}

export function subscribeToProgressUpdates(workspaceId: string, callback: (updates: ProgressUpdate[]) => void) {
  const q = query(
    collection(db, 'progressUpdates'),
    where('workspaceId', '==', workspaceId),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const updates = snap.docs.map(d => ({ ...d.data(), id: d.id } as ProgressUpdate));
    updates.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    callback(updates);
  }, (error) => {
    console.error('subscribeToProgressUpdates error:', error);
    callback([]);
  });
}

// ===== Delivery Services =====
export async function submitDelivery(
  workspaceId: string, taskId: string, helperId: string,
  data: {
    deliveryNotes: string;
    versionLabel: string;
    checklist: DeliveryChecklist;
    files: DeliveryFile[];
    proofVideo: ProofVideo | null;
  }
) {
  const workspaceRef = doc(db, 'projectWorkspaces', workspaceId);
  const workspaceSnap = await getDoc(workspaceRef);
  if (!workspaceSnap.exists()) throw new Error('Workspace not found');
  const workspace = workspaceSnap.data() as ProjectWorkspace;

  const ref = doc(collection(db, 'deliveries'));
  const version = (workspace.currentVersion || 0) + 1;

  await runTransaction(db, async (transaction) => {
    const freshSnap = await transaction.get(workspaceRef);
    if (!freshSnap.exists()) throw new Error('Workspace not found');
    const fresh = freshSnap.data() as ProjectWorkspace;

    transaction.set(ref, {
      id: ref.id,
      workspaceId,
      taskId,
      helperId,
      version,
      isRevision: fresh.currentVersion > 0,
      deliveryNotes: data.deliveryNotes,
      versionLabel: data.versionLabel,
      checklistCompleted: Object.values(data.checklist).every(Boolean),
      checklist: data.checklist,
      files: data.files,
      proofVideo: data.proofVideo,
      status: 'submitted',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.update(workspaceRef, {
      currentVersion: version,
      status: 'delivered',
      updatedAt: serverTimestamp(),
    });

    transaction.update(doc(db, 'tasks', taskId), {
      status: 'pending_confirmation',
      helperConfirmed: true,
      updatedAt: serverTimestamp(),
    });
  });

  // Notify client
  const taskSnap = await getDoc(doc(db, 'tasks', taskId));
  const task = taskSnap.data() as Task;
  await createNotification({
    userId: task.clientId, taskId, workspaceId,
    type: 'project_uploaded',
    title: 'Project Delivered!',
    message: `Helper submitted v${version} of "${task.title}". Review the delivery.`,
  });

  return ref.id;
}

export function subscribeToDeliveries(workspaceId: string, callback: (deliveries: Delivery[]) => void) {
  const q = query(
    collection(db, 'deliveries'),
    where('workspaceId', '==', workspaceId),
    limit(10)
  );
  return onSnapshot(q, (snap) => {
    const deliveries = snap.docs.map(d => ({ ...d.data(), id: d.id } as Delivery));
    // Sort by version descending (latest first)
    deliveries.sort((a, b) => (b.version || 0) - (a.version || 0));
    callback(deliveries);
  }, (error) => {
    console.error('subscribeToDeliveries error:', error);
    callback([]);
  });
}

export async function confirmDelivery(workspaceId: string, taskId: string, deliveryId: string, clientId: string) {
  const taskRef = doc(db, 'tasks', taskId);
  const workspaceRef = doc(db, 'projectWorkspaces', workspaceId);
  const deliveryRef = doc(db, 'deliveries', deliveryId);

  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (task.clientId !== clientId) throw new Error('Only client can confirm');
    if (task.status !== 'pending_confirmation') throw new Error('Task must be pending confirmation');

    const deliverySnap = await transaction.get(deliveryRef);
    if (!deliverySnap.exists()) throw new Error('Delivery not found');
    const delivery = deliverySnap.data() as Delivery;
    if (delivery.status === 'confirmed') throw new Error('Delivery already confirmed');

    // Get platform fee settings
    const settingsSnap = await transaction.get(doc(db, 'platformSettings', 'config'));
    const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { platformFeePercent: 5 };

    const fee = Math.floor(task.creditBounty * (settings.platformFeePercent || 5) / 100);
    const helperPayout = task.creditBounty - fee;

    // Credit the helper
    transaction.update(doc(db, 'users', task.finalHelperId!), {
      credits: increment(helperPayout),
      creditsEarned: increment(helperPayout),
      tasksCompleted: increment(1),
    });

    // Create release transaction
    const releaseRef = doc(collection(db, 'transactions'));
    transaction.set(releaseRef, {
      id: releaseRef.id,
      userId: task.finalHelperId,
      type: 'escrow_release',
      amount: helperPayout,
      fee,
      netAmount: helperPayout,
      status: 'completed',
      description: `Payment for task: ${task.title}`,
      taskId: task.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update delivery
    transaction.update(deliveryRef, {
      status: 'confirmed',
      confirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update workspace
    transaction.update(workspaceRef, {
      status: 'completed',
      deliveryConfirmed: true,
      deliveryConfirmedAt: serverTimestamp(),
      downloadEnabled: true,
      updatedAt: serverTimestamp(),
    });

    // Update task
    transaction.update(taskRef, {
      status: 'completed',
      clientConfirmed: true,
      escrowHeld: false,
      deliveryConfirmed: true,
      deliveryConfirmedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create notification for helper
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      id: notifRef.id,
      userId: task.finalHelperId,
      type: 'credits_released',
      title: 'Credits Released! 🎉',
      message: `Client confirmed delivery for "${task.title}". ${formatCredits(helperPayout)} credits have been released.`,
      taskId,
      workspaceId,
      read: false,
      createdAt: serverTimestamp(),
    });

    // Rating required notification for client
    const ratingNotifRef = doc(collection(db, 'notifications'));
    transaction.set(ratingNotifRef, {
      id: ratingNotifRef.id,
      userId: clientId,
      type: 'rating_required',
      title: 'Rate the Helper',
      message: `Please rate the helper's work on "${task.title}".`,
      taskId,
      workspaceId,
      read: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function logDownloadEvent(fileName: string, userId: string, taskId: string, deliveryId: string) {
  await addDoc(collection(db, 'adminLogs'), {
    action: 'file_downloaded',
    targetType: 'task',
    targetId: taskId,
    oldValue: '',
    newValue: `File: ${fileName} downloaded by ${userId}`,
    reason: 'Secure download',
    adminId: userId,
    createdAt: serverTimestamp(),
  });
}

// ===== Notification Services =====
async function createNotification(data: {
  userId: string; taskId?: string; workspaceId?: string;
  type: NotificationType; title: string; message: string;
}) {
  const notifRef = doc(collection(db, 'notifications'));
  await setDoc(notifRef, {
    id: notifRef.id,
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
  return notifRef.id;
}

export function subscribeToNotifications(userId: string, callback: (notifications: Notification[]) => void) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Notification)));
  });
}

export async function markNotificationRead(notificationId: string) {
  await updateDoc(doc(db, 'notifications', notificationId), { read: true });
}

export async function markAllNotificationsRead(userId: string) {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false),
    limit(50)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    batch.update(d.ref, { read: true });
  });
  await batch.commit();
}

// ===== Enhanced Dispute & Rework Services =====
export async function raiseDispute(
  taskId: string, raisedBy: string, raisedByName: string,
  data: {
    reason: DisputeReason; description: string; severity: DisputeSeverity;
    expectedResult?: string; actualIssue?: string; screenshots?: string[];
  }
) {
  const taskRef = doc(db, 'tasks', taskId);

  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    // Set dispute window (48h from now)
    const disputeWindowEnd = new Date(Date.now() + 48 * 60 * 60 * 1000);

    // Create dispute document
    const disputeRef = doc(collection(db, 'disputes'));
    transaction.set(disputeRef, {
      id: disputeRef.id,
      taskId,
      raisedBy,
      raisedByName,
      reason: data.reason,
      description: data.description,
      severity: data.severity,
      status: 'open',
      expectedResult: data.expectedResult || '',
      actualIssue: data.actualIssue || '',
      screenshots: data.screenshots || [],
      disputeWindowEnd: Timestamp.fromDate(disputeWindowEnd),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update task status
    transaction.update(taskRef, {
      status: 'disputed',
      disputeWindowEnd: Timestamp.fromDate(disputeWindowEnd),
      updatedAt: serverTimestamp(),
    });

    // Update workspace if it exists
    if (task.workspaceId) {
      transaction.update(doc(db, 'projectWorkspaces', task.workspaceId), {
        status: 'disputed',
        updatedAt: serverTimestamp(),
      });
    }

    // Notify admin (find admin users - create a log entry that admins can see)
    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      id: logRef.id,
      adminId: 'system',
      action: 'dispute_raised',
      targetType: 'dispute',
      targetId: taskId,
      oldValue: task.status,
      newValue: 'disputed',
      reason: `Dispute raised by ${raisedByName}: ${data.reason} - ${data.description}`,
      createdAt: serverTimestamp(),
    });

    // Notify the other party
    const otherPartyId = raisedBy === task.clientId ? task.finalHelperId! : task.clientId;
    const otherNotif = doc(collection(db, 'notifications'));
    transaction.set(otherNotif, {
      id: otherNotif.id,
      userId: otherPartyId,
      type: 'dispute_raised',
      title: 'Dispute Raised',
      message: `A dispute has been raised on "${task.title}". Admin will review shortly.`,
      taskId,
      workspaceId: task.workspaceId || '',
      read: false,
      createdAt: serverTimestamp(),
    });
  });
}

export async function requestRework(
  disputeId: string, taskId: string, adminId: string, adminName: string,
  note: string, deadlineDays: number = 3
) {
  const taskRef = doc(db, 'tasks', taskId);
  const disputeRef = doc(db, 'disputes', disputeId);
  const reworkDeadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);

  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    transaction.update(disputeRef, {
      status: 'rework',
      action: 'rework',
      updatedAt: serverTimestamp(),
    });

    transaction.update(taskRef, {
      status: 'rework',
      reworkRequestedAt: serverTimestamp(),
      reworkDeadline: Timestamp.fromDate(reworkDeadline),
      updatedAt: serverTimestamp(),
    });

    if (task.workspaceId) {
      transaction.update(doc(db, 'projectWorkspaces', task.workspaceId), {
        status: 'rework',
        updatedAt: serverTimestamp(),
      });
    }

    // Notify helper
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      id: notifRef.id,
      userId: task.finalHelperId!,
      type: 'rework_requested',
      title: 'Rework Required',
      message: `Admin has requested rework on "${task.title}". ${note}`,
      taskId,
      workspaceId: task.workspaceId || '',
      read: false,
      createdAt: serverTimestamp(),
    });

    // Log action
    const actionRef = doc(collection(db, 'disputeActions'));
    transaction.set(actionRef, {
      id: actionRef.id,
      disputeId,
      adminId,
      adminName,
      action: 'request_rework',
      reason: note,
      note: `Rework deadline: ${reworkDeadline.toISOString()}`,
      createdAt: serverTimestamp(),
    });
  });
}

export async function submitRevisedProject(
  workspaceId: string, taskId: string, deliveryId: string, helperId: string,
  data: {
    deliveryNotes: string;
    versionLabel: string;
    checklist: DeliveryChecklist;
    files: DeliveryFile[];
    proofVideo: ProofVideo | null;
    fixNotes: string;
    whatChanged: string;
  }
) {
  const workspaceRef = doc(db, 'projectWorkspaces', workspaceId);
  const ref = doc(collection(db, 'deliveries'));

 let version = 1;

await runTransaction(db, async (transaction) => {
  const workspaceSnap = await transaction.get(workspaceRef);
  if (!workspaceSnap.exists()) throw new Error('Workspace not found');

  const workspace = workspaceSnap.data() as ProjectWorkspace;
  version = (workspace.currentVersion || 0) + 1;

  transaction.set(ref, {
    id: ref.id,
    workspaceId,
    taskId,
    helperId,
    version,
    isRevision: true,
    deliveryNotes: data.deliveryNotes,
    versionLabel: data.versionLabel,
    checklistCompleted: Object.values(data.checklist).every(Boolean),
    checklist: data.checklist,
    files: data.files,
    proofVideo: data.proofVideo,
    status: 'submitted',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  transaction.update(workspaceRef, {
    currentVersion: version,
    status: 'delivered',
    updatedAt: serverTimestamp(),
  });

  transaction.update(doc(db, 'tasks', taskId), {
    status: 'pending_confirmation',
    updatedAt: serverTimestamp(),
  });
});

  const taskSnap = await getDoc(doc(db, 'tasks', taskId));
  const task = taskSnap.data() as Task;

  // Notify client & admin
  await createNotification({
    userId: task.clientId, taskId, workspaceId,
    type: 'revised_project_uploaded',
    title: 'Revised Project Submitted',
    message: `Helper submitted revised v${version} of "${task.title}". Changes: ${data.whatChanged}`,
  });

  return ref.id;
}

export async function reassignTask(
  taskId: string, newHelperId: string, newHelperName: string,
  adminId: string, adminName: string, reason: string
) {
  const taskRef = doc(db, 'tasks', taskId);

  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;
    const previousHelperId = task.finalHelperId;

    // Update task
    transaction.update(taskRef, {
      previousHelperId,
      finalHelperId: newHelperId,
      status: 'assigned',
      reassignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Update or create workspace
    if (task.workspaceId) {
      transaction.update(doc(db, 'projectWorkspaces', task.workspaceId), {
        helperId: newHelperId,
        status: 'reassigned',
        updatedAt: serverTimestamp(),
      });
    } else {
      // Create new workspace
      const workspaceRef = doc(collection(db, 'projectWorkspaces'));
      transaction.set(workspaceRef, {
        id: workspaceRef.id,
        taskId,
        clientId: task.clientId,
        helperId: newHelperId,
        status: 'active',
        deliveryConfirmed: false,
        downloadEnabled: false,
        currentVersion: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(taskRef, { workspaceId: workspaceRef.id });
    }

    // Notify new helper
    const notifRef = doc(collection(db, 'notifications'));
    transaction.set(notifRef, {
      id: notifRef.id,
      userId: newHelperId,
      type: 'task_reassigned',
      title: 'Task Reassigned to You',
      message: `You have been assigned to "${task.title}" by admin ${adminName}. ${reason}`,
      taskId,
      workspaceId: task.workspaceId || '',
      read: false,
      createdAt: serverTimestamp(),
    });

    // Log the action
    const actionRef = doc(collection(db, 'adminLogs'));
    transaction.set(actionRef, {
      id: actionRef.id,
      adminId,
      adminName,
      action: 'task_reassigned',
      targetType: 'task',
      targetId: taskId,
      oldValue: previousHelperId || 'none',
      newValue: newHelperId,
      reason,
      createdAt: serverTimestamp(),
    });
  });
}

export async function resolveDisputeEnhanced(
  taskId: string, adminId: string, adminName: string,
  action: 'release_to_helper' | 'refund_client' | 'partial_refund' | 'rework' | 'reassign',
  reason: string, partialAmount?: number
) {
  const taskRef = doc(db, 'tasks', taskId);

  await runTransaction(db, async (transaction) => {
    const taskSnap = await transaction.get(taskRef);
    if (!taskSnap.exists()) throw new Error('Task not found');
    const task = taskSnap.data() as Task;

    if (action === 'release_to_helper') {
      const settingsSnap = await transaction.get(doc(db, 'platformSettings', 'config'));
      const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { platformFeePercent: 5 };
      const fee = Math.floor(task.creditBounty * (settings.platformFeePercent || 5) / 100);
      const payout = task.creditBounty - fee;

      transaction.update(doc(db, 'users', task.finalHelperId!), {
        credits: increment(payout),
        creditsEarned: increment(payout),
      });

      transaction.update(taskRef, {
        status: 'completed',
        escrowHeld: false,
        updatedAt: serverTimestamp(),
      });
    } else if (action === 'refund_client') {
      transaction.update(doc(db, 'users', task.clientId), {
        credits: increment(task.creditBounty),
      });

      transaction.update(taskRef, {
        status: 'cancelled',
        escrowHeld: false,
        updatedAt: serverTimestamp(),
      });
    } else if (action === 'partial_refund' && partialAmount) {
      const refundAmount = Math.min(partialAmount, task.creditBounty);
      const helperAmount = task.creditBounty - refundAmount;

      transaction.update(doc(db, 'users', task.clientId), {
        credits: increment(refundAmount),
      });

      if (helperAmount > 0 && task.finalHelperId) {
        const settingsSnap = await transaction.get(doc(db, 'platformSettings', 'config'));
        const settings = settingsSnap.exists() ? (settingsSnap.data() as PlatformSettings) : { platformFeePercent: 5 };
        const fee = Math.floor(helperAmount * (settings.platformFeePercent || 5) / 100);
        const payout = helperAmount - fee;

        transaction.update(doc(db, 'users', task.finalHelperId), {
          credits: increment(payout),
        });
      }

      transaction.update(taskRef, {
        status: 'completed',
        escrowHeld: false,
        updatedAt: serverTimestamp(),
      });
    }

    // Update workspace if exists
    if (task.workspaceId) {
      transaction.update(doc(db, 'projectWorkspaces', task.workspaceId), {
        status: action === 'release_to_helper' || action === 'partial_refund' ? 'completed' : 'active',
        downloadEnabled: action === 'release_to_helper' || action === 'partial_refund',
        updatedAt: serverTimestamp(),
      });
    }

    // Log the action
    const logRef = doc(collection(db, 'adminLogs'));
    transaction.set(logRef, {
      id: logRef.id,
      adminId,
      adminName,
      action: `resolve_dispute_${action}`,
      targetType: 'dispute',
      targetId: taskId,
      oldValue: 'disputed',
      newValue: action === 'release_to_helper' ? 'completed' : 'cancelled',
      reason,
      createdAt: serverTimestamp(),
    });
  });
}

// Get disputes for a task
export function subscribeToDisputesByTask(taskId: string, callback: (disputes: Dispute[]) => void) {
  const q = query(
    collection(db, 'disputes'),
    where('taskId', '==', taskId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as Dispute)));
  });
}

export function subscribeToDisputeActions(disputeId: string, callback: (actions: DisputeAction[]) => void) {
  const q = query(
    collection(db, 'disputeActions'),
    where('disputeId', '==', disputeId),
    orderBy('createdAt', 'asc'),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ ...d.data(), id: d.id } as DisputeAction)));
  });
}
