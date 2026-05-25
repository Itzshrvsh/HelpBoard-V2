const rateLimitStore: Record<string, { attempts: number[] }> = {};

/**
 * Basic in-memory rate limiter.
 * Returns true if action is allowed, false if rate limited.
 */
export function checkRateLimit(action: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const key = `ratelimit_${action}`;
  
  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { attempts: [] };
  }

  const entry = rateLimitStore[key];
  // Remove expired attempts
  entry.attempts = entry.attempts.filter(t => now - t < windowMs);
  
  if (entry.attempts.length >= maxAttempts) {
    return false; // Rate limited
  }

  entry.attempts.push(now);
  return true;
}

/**
 * Higher-order function that wraps an async function with rate limiting.
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  action: string,
  maxAttempts: number,
  windowMs: number
): T {
  return (async (...args: any[]) => {
    if (!checkRateLimit(action, maxAttempts, windowMs)) {
      throw new Error(`Rate limit exceeded for ${action}. Please try again later.`);
    }
    return fn(...args);
  }) as T;
}
