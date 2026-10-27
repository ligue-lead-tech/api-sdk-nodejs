import type { ApiErrorDetails } from '../Types/Errors';
import { LigueLeadApiError } from './LigueLeadApiError';

/** 429 — the API Gateway throttled the request. */
export class LigueLeadRateLimitError extends LigueLeadApiError {
  /** How long the server asked to wait, from `Retry-After`, when it said so. */
  readonly retryAfterMs: number | undefined;

  /**
   * @param {string} message - The gateway's message.
   * @param {ApiErrorDetails & { retryAfterMs: number | undefined }} details - Request, answer and delay.
   */
  constructor(
    message: string,
    details: ApiErrorDetails & { retryAfterMs: number | undefined },
  ) {
    super(
      message,
      details,
    );

    this.retryAfterMs = details.retryAfterMs;
  }
}
