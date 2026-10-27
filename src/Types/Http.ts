import type { RequestOptions } from './ClientOptions';
import type { FieldError, HttpMethod } from './Shared';

/**
 * Which credentials a route takes: `app` sends `api-token` and `app-id`; `token` sends only
 * `api-token` (the `/apps` routes, which manage the apps themselves).
 */
export type AuthScope = 'app' | 'token';

/** A query-string value; `undefined` leaves the parameter out. */
export type QueryValue = string | number | boolean | undefined;

/** One call to the API, as the resources describe it. */
export interface ApiRequest {
  method: HttpMethod;
  /** Path relative to the base URL, starting with `/`, ids already encoded (see `ApiPath`). */
  path: string;
  query?: Readonly<Record<string, QueryValue>> | undefined;
  /** A JSON-serializable object, or a `FormData` for multipart. */
  body?: unknown;
  auth: AuthScope;
  /**
   * `true` when the route answers `{ message, data }`: the SDK returns `data`. The API is not
   * uniform here — agents and voice actions answer the object itself.
   */
  envelope: boolean;
  options?: RequestOptions | undefined;
}

/** Where a request went. */
export interface RequestContext {
  method: HttpMethod;
  path: string;
}

/** What could be read from an error body. */
export interface ParsedErrorBody {
  message: string | undefined;
  fieldErrors: FieldError[];
  routeNotFound: boolean;
}
