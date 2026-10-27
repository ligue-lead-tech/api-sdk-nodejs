import type { ApiErrorDetails } from '../Types/Errors';
import { LigueLeadApiError } from './LigueLeadApiError';

/** 404 — the resource does not exist, belongs to another client, or (recipients) has expired. */
export class LigueLeadNotFoundError extends LigueLeadApiError {
  /**
   * `true` when the 404 came from the router, not from a resource lookup: the route itself does not
   * exist, which means this SDK and the API have drifted apart.
   */
  readonly routeNotFound: boolean;

  /**
   * @param {string} message - The server's message.
   * @param {ApiErrorDetails & { routeNotFound: boolean }} details - Request, answer and route flag.
   */
  constructor(
    message: string,
    details: ApiErrorDetails & { routeNotFound: boolean },
  ) {
    super(
      message,
      details,
    );

    this.routeNotFound = details.routeNotFound;
  }
}
