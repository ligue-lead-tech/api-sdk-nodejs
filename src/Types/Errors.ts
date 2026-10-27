import type { FieldError, HttpMethod } from './Shared';

/** What every API error knows about the request and the answer that produced it. */
export interface ApiErrorDetails {
  /** HTTP status of the answer. */
  status: number;
  /** Method of the request. */
  method: HttpMethod;
  /** Path of the request, relative to the base URL and without the query string. */
  path: string;
  /** Parsed body of the answer, with long strings truncated. */
  body: unknown;
  /** Field-level reasons of a validation answer; empty when the server sent a single message. */
  fieldErrors: readonly FieldError[];
  /**
   * `true` when the request may have taken effect even though it failed: a send that got a 5xx may
   * still have created the campaign. Check before sending again — the API has no idempotency key,
   * so a second send is a second campaign, charged again.
   */
  outcomeUnknown: boolean;
}

/** Where a transport failure happened. */
export interface TransportErrorDetails {
  /** Method of the request. */
  method: HttpMethod;
  /** Path of the request, relative to the base URL and without the query string. */
  path: string;
  /** System or axios error code (`ECONNRESET`, `ETIMEDOUT`), when there was one. */
  code: string | undefined;
  /**
   * `true` when the request may have reached the API before the connection failed. Always `false`
   * for a GET, which has no effect to repeat.
   */
  outcomeUnknown: boolean;
}

/** The answer behind a `LigueLeadUnexpectedResponseError`. */
export interface UnexpectedResponseDetails {
  status: number;
  method: HttpMethod;
  path: string;
  body: unknown;
}
