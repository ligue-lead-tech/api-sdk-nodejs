import { RetryPolicy } from '../../../src/Client/RetryPolicy';
import {
  LigueLeadAbortError,
  LigueLeadApiError,
  LigueLeadAuthenticationError,
  LigueLeadConnectionError,
  LigueLeadRateLimitError,
  LigueLeadServerError,
  LigueLeadTimeoutError,
} from '../../../src/Errors';
import type { HttpMethod } from '../../../src/Types/Shared';

function apiError(status: number): LigueLeadApiError {
  const details = { status, method: 'GET' as const, path: '/x', body: undefined, fieldErrors: [], outcomeUnknown: false };

  if (status === 401) {
    return new LigueLeadAuthenticationError('denied', details);
  }

  return status >= 500 ? new LigueLeadServerError('boom', details) : new LigueLeadApiError('other', details);
}

function rateLimited(retryAfterMs: number | undefined): LigueLeadRateLimitError {
  return new LigueLeadRateLimitError('slow down', {
    status: 429, method: 'GET', path: '/x', body: undefined, fieldErrors: [], outcomeUnknown: false, retryAfterMs,
  });
}

const connection = new LigueLeadConnectionError('reset', { method: 'GET', path: '/x', code: 'ECONNRESET', outcomeUnknown: false });
const timeout = new LigueLeadTimeoutError('timeout', { method: 'GET', path: '/x', code: 'ETIMEDOUT', outcomeUnknown: false });

const policy = new RetryPolicy();

describe('RetryPolicy.shouldRetry', () => {
  it.each([
    ['connection error', connection],
    ['timeout', timeout],
    ['429', rateLimited(undefined)],
    ['500', apiError(500)],
    ['502', apiError(502)],
    ['503', apiError(503)],
    ['504', apiError(504)],
  ])('retries a GET after a %s', (_label, error) => {
    expect(policy.shouldRetry('GET', error)).toBe(true);
  });

  it.each([
    ['401', apiError(401)],
    ['400', apiError(400)],
    ['404', apiError(404)],
    ['501', apiError(501)],
    ['an abort', new LigueLeadAbortError('aborted')],
    ['a foreign error', new Error('bug')],
  ])('does not retry a GET after %s', (_label, error) => {
    expect(policy.shouldRetry('GET', error)).toBe(false);
  });

  it.each<HttpMethod>(['POST', 'PUT', 'DELETE'])('never retries a %s', (method) => {
    expect(policy.shouldRetry(method, connection)).toBe(false);
    expect(policy.shouldRetry(method, timeout)).toBe(false);
    expect(policy.shouldRetry(method, apiError(503))).toBe(false);
  });
});

describe('RetryPolicy.delayFor', () => {
  it('grows exponentially under full jitter, capped at 8 s', () => {
    expect(new RetryPolicy({ random: () => 0.999 }).delayFor(connection, 0)).toBe(499);
    expect(new RetryPolicy({ random: () => 0.5 }).delayFor(connection, 1)).toBe(500);
    expect(new RetryPolicy({ random: () => 0.999 }).delayFor(connection, 3)).toBe(3996);
    expect(new RetryPolicy({ random: () => 0.999 }).delayFor(connection, 10)).toBe(7992);
    expect(new RetryPolicy({ random: () => 0 }).delayFor(connection, 2)).toBe(0);
  });

  it('follows Retry-After up to the maximum, and gives up beyond it', () => {
    expect(new RetryPolicy({ random: () => 0.5 }).delayFor(rateLimited(2000), 0)).toBe(2000);
    expect(new RetryPolicy({ random: () => 0.5 }).delayFor(rateLimited(RetryPolicy.MAX_RETRY_AFTER_MS), 0)).toBe(RetryPolicy.MAX_RETRY_AFTER_MS);
    expect(new RetryPolicy({ random: () => 0.5 }).delayFor(rateLimited(RetryPolicy.MAX_RETRY_AFTER_MS + 1), 0)).toBeUndefined();
  });

  it('falls back to backoff on a 429 without Retry-After', () => {
    expect(new RetryPolicy({ random: () => 0.5 }).delayFor(rateLimited(undefined), 0)).toBe(250);
  });
});

describe('RetryPolicy.parseRetryAfter', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');

  it('reads seconds and HTTP dates', () => {
    expect(RetryPolicy.parseRetryAfter('3', now)).toBe(3000);
    expect(RetryPolicy.parseRetryAfter(' 0 ', now)).toBe(0);
    expect(RetryPolicy.parseRetryAfter('Wed, 07 Oct 2026 12:00:05 GMT', now)).toBe(5000);
    expect(RetryPolicy.parseRetryAfter('Wed, 07 Oct 2026 11:59:00 GMT', now)).toBe(0);
  });

  it.each([undefined, '', 'soon', 12, ['3']])('ignores %p', (value) => {
    expect(RetryPolicy.parseRetryAfter(value, now)).toBeUndefined();
  });
});

describe('RetryPolicy.sleep', () => {
  it('resolves after the delay', async () => {
    await expect(RetryPolicy.sleep(1)).resolves.toBeUndefined();
  });

  it('resolves when the signal never aborts', async () => {
    await expect(RetryPolicy.sleep(1, new AbortController().signal)).resolves.toBeUndefined();
  });

  it('rejects at once when the signal is already aborted', async () => {
    await expect(RetryPolicy.sleep(10_000, AbortSignal.abort())).rejects.toBeInstanceOf(LigueLeadAbortError);
  });

  it('rejects when the signal aborts during the wait', async () => {
    const controller = new AbortController();
    const waiting = RetryPolicy.sleep(10_000, controller.signal);

    controller.abort();

    await expect(waiting).rejects.toBeInstanceOf(LigueLeadAbortError);
  });
});

describe('RetryPolicy.pause', () => {
  it('waits through the sleep it was given', async () => {
    const waits: [number, AbortSignal | undefined][] = [];
    const signal = new AbortController().signal;
    const custom = new RetryPolicy({
      sleep: (ms, given) => {
        waits.push([ms, given]);
        return Promise.resolve();
      },
    });

    await custom.pause(250, signal);

    expect(waits).toEqual([[250, signal]]);
  });

  it('waits for real by default', async () => {
    await expect(new RetryPolicy().pause(1)).resolves.toBeUndefined();
  });
});
