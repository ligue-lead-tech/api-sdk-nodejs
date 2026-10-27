import { LigueLeadAbortError } from '../Errors/LigueLeadAbortError';
import { LigueLeadApiError } from '../Errors/LigueLeadApiError';
import { LigueLeadConnectionError } from '../Errors/LigueLeadConnectionError';
import { LigueLeadRateLimitError } from '../Errors/LigueLeadRateLimitError';
import type { HttpMethod } from '../Types/Shared';

/** What `RetryPolicy` depends on; tests replace them. */
export interface RetryPolicyCollaborators {
  /** Source of randomness in [0, 1), for the jitter. */
  random?: () => number;
  /** Waits between attempts, giving up when the signal aborts. */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

/**
 * When a failed request is repeated, and after how long.
 *
 * Only a GET is ever repeated. The API has no idempotency key: a send repeated after a timeout or a
 * 5xx is a second campaign, charged again, and a PUT on an RCS agent resubmits it for review. A 401
 * is never repeated either — the server blocks an invalid token for an hour.
 */
export class RetryPolicy {
  /** Statuses worth repeating a GET for: throttling and server or gateway failures. */
  static readonly RETRYABLE_STATUSES: ReadonlySet<number> = new Set([
    429,
    500,
    502,
    503,
    504,
  ]);

  /** Longest `Retry-After` the SDK waits for; beyond it, the error goes to the caller. */
  static readonly MAX_RETRY_AFTER_MS = 30_000;

  /** First backoff ceiling; it doubles on every attempt. */
  static readonly BASE_DELAY_MS = 500;

  /** Highest backoff ceiling. */
  static readonly MAX_DELAY_MS = 8_000;

  readonly #random: () => number;

  readonly #sleep: (ms: number, signal?: AbortSignal) => Promise<void>;

  /**
   * @param {RetryPolicyCollaborators} [collaborators] - Replacements for randomness and waiting.
   */
  constructor(collaborators: RetryPolicyCollaborators = {}) {
    this.#random = collaborators.random ?? Math.random;

    this.#sleep = collaborators.sleep ?? ((
      ms,
      signal,
    ) => RetryPolicy.sleep(
      ms,
      signal,
    ));
  }

  /**
   * Whether a failed request may be sent again.
   *
   * @param {HttpMethod} method - Method of the failed request.
   * @param {unknown} error - What the attempt threw.
   *
   * @returns {boolean} `true` when the request can be repeated.
   */
  shouldRetry(
    method: HttpMethod,
    error: unknown,
  ): boolean {
    if (
      method !== 'GET'
      || error instanceof LigueLeadAbortError
    ) {
      return false;
    }

    if (error instanceof LigueLeadConnectionError) {
      return true;
    }

    return error instanceof LigueLeadApiError && RetryPolicy.RETRYABLE_STATUSES.has(error.status);
  }

  /**
   * How long to wait before the next attempt, or `undefined` to stop retrying.
   *
   * A `Retry-After` the server sent wins, up to `MAX_RETRY_AFTER_MS`; past that the caller is better
   * placed to decide. Otherwise exponential backoff with full jitter, so clients that failed
   * together do not come back together.
   *
   * @param {unknown} error - What the attempt threw.
   * @param {number} attempt - Zero-based number of the attempt that failed.
   *
   * @returns {number | undefined} Delay in milliseconds, or `undefined` when not to retry.
   */
  delayFor(
    error: unknown,
    attempt: number,
  ): number | undefined {
    if (
      error instanceof LigueLeadRateLimitError
      && error.retryAfterMs !== undefined
    ) {
      return error.retryAfterMs <= RetryPolicy.MAX_RETRY_AFTER_MS
        ? error.retryAfterMs
        : undefined;
    }

    const ceiling = Math.min(
      RetryPolicy.MAX_DELAY_MS,
      RetryPolicy.BASE_DELAY_MS * 2 ** attempt,
    );

    return Math.floor(this.#random() * ceiling);
  }

  /**
   * Waits before the next attempt.
   *
   * @param {number} ms - Milliseconds to wait.
   * @param {AbortSignal} [signal] - Cancels the wait.
   *
   * @throws {LigueLeadAbortError} When the signal aborts before or during the wait.
   *
   * @returns {Promise<void>} Resolves when the time has passed.
   */
  async pause(
    ms: number,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.#sleep(
      ms,
      signal,
    );
  }

  /**
   * Reads a `Retry-After` header, given in seconds or as an HTTP date.
   *
   * @param {unknown} value - Raw header value.
   * @param {number} now - Current time in milliseconds, for the date form.
   *
   * @returns {number | undefined} Milliseconds to wait, or `undefined` when absent or unreadable.
   */
  static parseRetryAfter(
    value: unknown,
    now: number,
  ): number | undefined {
    if (
      typeof value !== 'string'
      || value.trim() === ''
    ) {
      return undefined;
    }

    const text = value.trim();

    if (/^\d+$/.test(text)) {
      return Number(text) * 1000;
    }

    const date = Date.parse(text);

    return Number.isNaN(date)
      ? undefined
      : Math.max(
          0,
          date - now,
        );
  }

  /**
   * Waits, giving up as soon as the signal aborts.
   *
   * @param {number} ms - Milliseconds to wait.
   * @param {AbortSignal} [signal] - Cancels the wait.
   *
   * @throws {LigueLeadAbortError} When the signal aborts before or during the wait.
   *
   * @returns {Promise<void>} Resolves when the time has passed.
   */
  static sleep(
    ms: number,
    signal?: AbortSignal,
  ): Promise<void> {
    return new Promise((
      resolve,
      reject,
    ) => {
      if (signal?.aborted === true) {
        reject(new LigueLeadAbortError('The request was aborted'));

        return;
      }

      const onAbort = (): void => {
        clearTimeout(timer);
        reject(new LigueLeadAbortError('The request was aborted'));
      };

      const timer = setTimeout(
        () => {
          signal?.removeEventListener(
            'abort',
            onAbort,
          );

          resolve();
        },
        ms,
      );

      signal?.addEventListener(
        'abort',
        onAbort,
        { once: true },
      );
    });
  }
}
