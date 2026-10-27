import { isAxiosError } from 'axios';
import { LigueLeadAbortError } from '../Errors/LigueLeadAbortError';
import { LigueLeadApiError } from '../Errors/LigueLeadApiError';
import { LigueLeadAuthenticationError } from '../Errors/LigueLeadAuthenticationError';
import { LigueLeadBadRequestError } from '../Errors/LigueLeadBadRequestError';
import { LigueLeadConflictError } from '../Errors/LigueLeadConflictError';
import { LigueLeadConnectionError } from '../Errors/LigueLeadConnectionError';
import { LigueLeadNotFoundError } from '../Errors/LigueLeadNotFoundError';
import { LigueLeadPayloadTooLargeError } from '../Errors/LigueLeadPayloadTooLargeError';
import { LigueLeadRateLimitError } from '../Errors/LigueLeadRateLimitError';
import { LigueLeadServerError } from '../Errors/LigueLeadServerError';
import { LigueLeadTimeoutError } from '../Errors/LigueLeadTimeoutError';
import { LigueLeadUnsupportedMediaTypeError } from '../Errors/LigueLeadUnsupportedMediaTypeError';
import { LigueLeadValidationError } from '../Errors/LigueLeadValidationError';
import { Json } from '../Support/Json';
import type { ApiErrorDetails } from '../Types/Errors';
import type { ParsedErrorBody, RequestContext } from '../Types/Http';
import type { FieldError } from '../Types/Shared';
import { RetryPolicy } from './RetryPolicy';

/** What `ErrorMapper` depends on; tests replace it. */
export interface ErrorMapperCollaborators {
  /** Current time in milliseconds, for an HTTP-date `Retry-After`. */
  now?: () => number;
}

/**
 * Turns what the API (or the network) answered into the SDK's errors.
 *
 * The API answers errors in four shapes, and this reads all of them:
 * - `{ error: [{ field, message }] }` — schema validation (422);
 * - `{ error: "..." }` — every other error the API raises, and `{ status, error }` for a 413;
 * - `{ message: "..." }` — the API Gateway's own answers (429, 504);
 * - an HTML page — Express's 404 for a route that does not exist (`Cannot POST /v1/x`).
 *
 * Messages are passed through unchanged; some are in Portuguese, and that is the API's choice.
 */
export class ErrorMapper {
  static readonly MAX_BODY_TEXT = 2048;

  static readonly MAX_MESSAGE_TEXT = 300;

  static readonly MAX_FIELD_ERRORS_IN_MESSAGE = 5;

  static readonly #EXPRESS_ROUTE_NOT_FOUND = /^Cannot (GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS) \//;

  readonly #now: () => number;

  /**
   * @param {ErrorMapperCollaborators} [collaborators] - Replacement for the clock.
   */
  constructor(collaborators: ErrorMapperCollaborators = {}) {
    this.#now = collaborators.now ?? Date.now;
  }

  /**
   * Reads the message and field errors out of an error body.
   *
   * @param {unknown} body - Parsed body of the answer.
   *
   * @returns {ParsedErrorBody} The message (if any), the field errors and the route-not-found flag.
   */
  parseBody(body: unknown): ParsedErrorBody {
    if (Json.isObject(body)) {
      const {
        error,
        message,
      } = body;

      if (Array.isArray(error)) {
        const fieldErrors = error.filter(ErrorMapper.#isFieldError).map(({
          field,
          message: text,
        }) => ({
          field,
          message: text,
        }));

        return {
          message: fieldErrors.length > 0
            ? ErrorMapper.#describeFieldErrors(fieldErrors)
            : undefined,
          fieldErrors,
          routeNotFound: false,
        };
      }

      if (
        typeof error === 'string'
        && error !== ''
      ) {
        return {
          message: error,
          fieldErrors: [],
          routeNotFound: false,
        };
      }

      if (
        typeof message === 'string'
        && message !== ''
      ) {
        return {
          message,
          fieldErrors: [],
          routeNotFound: false,
        };
      }
    }

    if (
      typeof body === 'string'
      && body.trim() !== ''
    ) {
      return ErrorMapper.#parseText(body.trim());
    }

    return {
      message: undefined,
      fieldErrors: [],
      routeNotFound: false,
    };
  }

  /**
   * Builds the error for an answer outside 2xx.
   *
   * @param {number} status - HTTP status of the answer.
   * @param {unknown} body - Parsed body of the answer.
   * @param {Record<string, unknown>} headers - Headers of the answer, lowercased.
   * @param {RequestContext} context - Method and path of the request.
   *
   * @returns {LigueLeadApiError} The subclass that matches the status.
   */
  fromResponse(
    status: number,
    body: unknown,
    headers: Record<string, unknown>,
    context: RequestContext,
  ): LigueLeadApiError {
    const parsed = this.parseBody(body);
    const message = parsed.message ?? `Request failed with status ${String(status)}`;

    const details: ApiErrorDetails = {
      status,
      method: context.method,
      path: context.path,
      body: typeof body === 'string'
        ? ErrorMapper.#truncate(
            body,
            ErrorMapper.MAX_BODY_TEXT,
          )
        : body,
      fieldErrors: parsed.fieldErrors,
      // A send that got a 5xx may have been queued before the failure; a GET has no effect to repeat.
      outcomeUnknown: context.method !== 'GET' && status >= 500,
    };

    switch (status) {
      case 400:
        return new LigueLeadBadRequestError(
          message,
          details,
        );
      case 401:
        return new LigueLeadAuthenticationError(
          message,
          details,
        );
      case 404:
        return new LigueLeadNotFoundError(
          message,
          {
            ...details,
            routeNotFound: parsed.routeNotFound,
          },
        );
      case 409:
        return new LigueLeadConflictError(
          message,
          details,
        );
      case 413:
        return new LigueLeadPayloadTooLargeError(
          message,
          details,
        );
      case 415:
        return new LigueLeadUnsupportedMediaTypeError(
          message,
          details,
        );
      case 422:
        return new LigueLeadValidationError(
          message,
          details,
        );
      case 429:
        return new LigueLeadRateLimitError(
          message,
          {
            ...details,
            retryAfterMs: RetryPolicy.parseRetryAfter(
              headers['retry-after'],
              this.#now(),
            ),
          },
        );
      default:
        return status >= 500
          ? new LigueLeadServerError(
              message,
              details,
            )
          : new LigueLeadApiError(
              message,
              details,
            );
    }
  }

  /**
   * Maps a failure that produced no answer to an SDK error.
   *
   * The original axios error is never kept: its `config.headers` carries the `api-token`, and an
   * error is the object most likely to end up in a log. The cause keeps only code and message.
   *
   * @param {unknown} error - What axios threw.
   * @param {RequestContext} context - Method and path of the request.
   *
   * @returns {unknown} The SDK error, or the original value when it did not come from axios.
   */
  fromTransport(
    error: unknown,
    context: RequestContext,
  ): unknown {
    if (!isAxiosError(error)) {
      return error;
    }

    if (error.code === 'ERR_CANCELED') {
      return new LigueLeadAbortError(`${context.method} ${context.path} was aborted`);
    }

    const cause = Object.assign(
      new Error(error.message),
      { code: error.code },
    );

    const details = {
      method: context.method,
      path: context.path,
      code: error.code,
      outcomeUnknown: context.method !== 'GET',
    };

    if (error.code === 'ETIMEDOUT') {
      return new LigueLeadTimeoutError(
        `${context.method} ${context.path} timed out`,
        details,
        { cause },
      );
    }

    return new LigueLeadConnectionError(
      `${context.method} ${context.path} failed: ${error.message}`,
      details,
      { cause },
    );
  }

  static #parseText(text: string): ParsedErrorBody {
    if (!/^<(!doctype|html)/i.test(text)) {
      return {
        message: ErrorMapper.#truncate(
          text,
          ErrorMapper.MAX_MESSAGE_TEXT,
        ),
        fieldErrors: [],
        routeNotFound: false,
      };
    }

    const message = ErrorMapper.#truncate(
      (ErrorMapper.#preformatted(text) ?? ErrorMapper.#stripTags(text)).replace(
        /\s+/g,
        ' ',
      ).trim(),
      ErrorMapper.MAX_MESSAGE_TEXT,
    );

    return {
      message,
      fieldErrors: [],
      routeNotFound: ErrorMapper.#EXPRESS_ROUTE_NOT_FOUND.test(message),
    };
  }

  // Replaces every tag with a space in one pass: a `<[^>]*>` regex backtracks on an unclosed `<`. Like
  // that regex, a `<` never closed is not a tag, so the text after it is kept.
  static #stripTags(html: string): string {
    let text = '';
    let tagStart = -1;

    for (let index = 0; index < html.length; index++) {
      const char = html.charAt(index);

      if (
        tagStart === -1
        && char === '<'
      ) {
        tagStart = index;
      } else if (
        tagStart !== -1
               && char === '>'
      ) {
        tagStart = -1;
        text += ' ';
      } else if (tagStart === -1) {
        text += char;
      }
    }

    return tagStart === -1
      ? text
      : text + html.slice(tagStart);
  }

  // The text of the first <pre> element, found by position: a lazy regex over the whole page
  // backtracks on large bodies without a closing tag.
  static #preformatted(html: string): string | undefined {
    const lower = html.toLowerCase();
    const open = lower.indexOf('<pre>');

    const close = open === -1
      ? -1
      : lower.indexOf(
          '</pre>',
          open,
        );

    return open === -1 || close === -1
      ? undefined
      : html.slice(
          open + '<pre>'.length,
          close,
        );
  }

  static #isFieldError(value: unknown): value is FieldError {
    return Json.isObject(value) && typeof value.field === 'string' && typeof value.message === 'string';
  }

  static #describeFieldErrors(fieldErrors: readonly FieldError[]): string {
    const described = fieldErrors
      .slice(
        0,
        ErrorMapper.MAX_FIELD_ERRORS_IN_MESSAGE,
      )
      .map(({
        field,
        message,
      }) => (field === ''
        ? message
        : `${field}: ${message}`))
      .join('; ');

    const rest = fieldErrors.length - ErrorMapper.MAX_FIELD_ERRORS_IN_MESSAGE;

    // The full list stays in `fieldErrors`; the message is what ends up on one log line.
    return rest > 0
      ? `${described}; and ${String(rest)} more`
      : described;
  }

  static #truncate(
    text: string,
    max: number,
  ): string {
    return text.length > max
      ? `${text.slice(
        0,
        max,
      )}…`
      : text;
  }
}
