import { format, formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCredits(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

export function formatTimestamp(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return 'N/A';
  return format(timestamp.toDate(), 'MMM d, yyyy h:mm a');
}

export function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return '';
  return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
}

export function getTimeRemaining(deadline: Timestamp | null | undefined): { days: number; hours: number; minutes: number; expired: boolean } {
  if (!deadline) return { days: 0, hours: 0, minutes: 0, expired: true };
  const now = Date.now();
  const end = deadline.toDate().getTime();
  const diff = end - now;

  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, expired: true };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  return { days, hours, minutes, expired: false };
}

export function sanitizeInput(input: string): string {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validateCreditAmount(amount: number, min: number, max: number): string | null {
  if (isNaN(amount) || amount <= 0) return 'Amount must be greater than 0';
  if (amount < min) return `Minimum amount is ${formatCredits(min)} credits`;
  if (amount > max) return `Maximum amount is ${formatCredits(max)} credits`;
  return null;
}

export const RATE_LIMITS = {
  LOGIN: { maxAttempts: 5, windowMs: 15 * 60 * 1000 },
  SIGNUP: { maxAttempts: 3, windowMs: 60 * 60 * 1000 },
  TASK_POST: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
  TASK_CLAIM: { maxAttempts: 20, windowMs: 60 * 60 * 1000 },
  CHAT_MESSAGE: { maxAttempts: 60, windowMs: 60 * 1000 },
  PAYMENT_SUBMIT: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  WITHDRAWAL_REQUEST: { maxAttempts: 3, windowMs: 24 * 60 * 60 * 1000 },
  RATING: { maxAttempts: 10, windowMs: 60 * 60 * 1000 },
};
