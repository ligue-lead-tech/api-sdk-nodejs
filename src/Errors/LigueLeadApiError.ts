import type { ApiErrorDetails } from '../Types/Errors';
import type { FieldError, HttpMethod } from '../Types/Shared';
import { LigueLeadError } from './LigueLeadError';

/**
 * The API answered with a status outside 2xx.
 *
 * The subclasses cover the statuses the API uses; this class itself is thrown for any other one (a
 * 3xx, since redirects are not followed, or a 403/405 from the gateway).
 */
export class LigueLeadApiError extends LigueLeadError implements ApiErrorDetails {
  /** Longest body, in characters of JSON, that `toJSON()` keeps. */
  static readonly MAX_LOGGED_BODY = 2048;

  /** How many field errors `toJSON()` keeps. */
  static readonly MAX_LOGGED_FIELD_ERRORS = 20;

  readonly status: number;

  readonly method: HttpMethod;

  readonly path: string;

  readonly body: unknown;

  readonly fieldErrors: readonly FieldError[];

  readonly outcomeUnknown: boolean;

  /**
   * @param {string} message - The server's message, or a generic one when it sent none.
   * @param {ApiErrorDetails} details - Request and answer the error came from.
   */
  constructor(
    message: string,
    details: ApiErrorDetails,
  ) {
    super(message);
    this.status = details.status;
    this.method = details.method;
    this.path = details.path;
    this.body = details.body;
    this.fieldErrors = details.fieldErrors;
    this.outcomeUnknown = details.outcomeUnknown;
  }

  /**
   * Plain-object form for structured logs, bounded in size.
   *
   * A send of 10000 malformed phones answers 10000 field errors, and an error is the object most
   * likely to be logged whole. The object keeps everything; only this form is cut: the body to
   * `MAX_LOGGED_BODY` characters of JSON, the field errors to the first `MAX_LOGGED_FIELD_ERRORS`,
   * with `fieldErrorCount` saying how many there were.
   *
   * @returns {Record<string, unknown>} The error's name, message and fields, bounded.
   */
  override toJSON(): Record<string, unknown> {
    // `JSON.stringify` returns undefined for an undefined body, whatever its declared type says.
    const serializedBody = JSON.stringify(this.body) as string | undefined;
    const bodyTooLarge = serializedBody !== undefined && serializedBody.length > LigueLeadApiError.MAX_LOGGED_BODY;
    const fieldErrorsCut = this.fieldErrors.length > LigueLeadApiError.MAX_LOGGED_FIELD_ERRORS;

    return {
      ...super.toJSON(),
      body: bodyTooLarge
        ? `${serializedBody.slice(
          0,
          LigueLeadApiError.MAX_LOGGED_BODY,
        )}…`
        : this.body,
      fieldErrors: this.fieldErrors.slice(
        0,
        LigueLeadApiError.MAX_LOGGED_FIELD_ERRORS,
      ),
      ...(fieldErrorsCut
        ? { fieldErrorCount: this.fieldErrors.length }
        : {}),
    };
  }
}
