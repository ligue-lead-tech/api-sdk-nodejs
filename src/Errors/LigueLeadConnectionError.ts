import type { TransportErrorDetails } from '../Types/Errors';
import type { HttpMethod } from '../Types/Shared';
import { LigueLeadError } from './LigueLeadError';

/**
 * No answer was received: DNS failure, refused or reset connection, TLS error.
 *
 * `cause` holds a copy of the underlying error with only its code and message — never the original
 * axios error, whose request config carries the `api-token` header.
 */
export class LigueLeadConnectionError extends LigueLeadError implements TransportErrorDetails {
  readonly method: HttpMethod;

  readonly path: string;

  readonly code: string | undefined;

  readonly outcomeUnknown: boolean;

  /**
   * @param {string} message - Description of the failure.
   * @param {TransportErrorDetails} details - Request the failure happened on.
   * @param {ErrorOptions} [options] - Standard error options, with the sanitized cause.
   */
  constructor(
    message: string,
    details: TransportErrorDetails,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );

    this.method = details.method;
    this.path = details.path;
    this.code = details.code;
    this.outcomeUnknown = details.outcomeUnknown;
  }
}
