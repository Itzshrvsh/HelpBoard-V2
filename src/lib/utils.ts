import { format, formatDistanceToNow } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatCredits(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

export function formatTimestamp(timestamp: Timestamp | string | null | undefined): string {
  if (!timestamp) return 'N/A';
  if (typeof timestamp === 'string') return format(new Date(timestamp), 'MMM d, yyyy h:mm a');
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

/** Compress an image file to a base64 data URL (max 800px, JPEG 80% quality).
 *  Falls back to raw base64 if compression fails.
 *  Keeps images well under Firestore's 1MB document limit.
 */
export function compressImage(file: File, maxSize: number = 800, quality: number = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Resize if needed
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height / width) * maxSize);
            width = maxSize;
          } else {
            width = Math.round((width / height) * maxSize);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback: return raw base64
          resolve(ev.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => {
        // Fallback: return raw base64
        resolve(ev.target?.result as string);
      };
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
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
