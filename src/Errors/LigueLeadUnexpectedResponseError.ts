import type { UnexpectedResponseDetails } from '../Types/Errors';
import type { HttpMethod } from '../Types/Shared';
import { LigueLeadError } from './LigueLeadError';

/**
 * The API answered 2xx with a body this SDK cannot read — an envelope without `data`, for instance.
 *
 * The request did succeed, so the effect happened; what failed is reading the answer. Seeing this
 * error means the API's contract changed under the SDK.
 */
export class LigueLeadUnexpectedResponseError extends LigueLeadError implements UnexpectedResponseDetails {
  readonly status: number;

  readonly method: HttpMethod;

  readonly path: string;

  readonly body: unknown;

  /**
   * @param {string} message - What was expected and not found.
   * @param {UnexpectedResponseDetails} details - The answer.
   */
  constructor(
    message: string,
    details: UnexpectedResponseDetails,
  ) {
    super(message);
    this.status = details.status;
    this.method = details.method;
    this.path = details.path;
    this.body = details.body;
  }
}
