import { AsyncLocalStorage } from 'async_hooks';

/**
 * Thread-safe auth token storage.
 *
 * Uses Node.js AsyncLocalStorage to isolate auth tokens per request.
 * Each concurrent request gets its own token context, preventing
 * one user's token from overwriting another's.
 *
 * Usage:
 *   // In request handler (chat.service.ts):
 *   runWithToken(token, async () => {
 *     await processMessage(...)
 *   })
 *
 *   // In tools:
 *   const token = getCurrentToken();
 */

const tokenStorage = new AsyncLocalStorage<string>();

/**
 * Run a function within a token context.
 * All code inside the callback (including async tool calls)
 * will see this token via getCurrentToken().
 */
export function runWithToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return tokenStorage.run(token, fn);
}

/**
 * Get the current request's auth token.
 * Returns null if called outside of a runWithToken context.
 */
export function getCurrentToken(): string | null {
  return tokenStorage.getStore() || null;
}
